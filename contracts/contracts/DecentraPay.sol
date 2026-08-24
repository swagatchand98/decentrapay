// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/// @title DecentraPay — biometric-identity point of sale with bounded terminal authority
/// @notice See docs/SPEC.md for the full design rationale and security model.
contract DecentraPay {
    // ─── errors ────────────────────────────────────────────────
    error NotOwner();
    error NotMerchant();
    error NotTerminalOwner();
    error InsufficientBalance(uint256 available, uint256 requested);
    error InsufficientMerchantBalance(uint256 available, uint256 requested);
    error TransferFailed();
    error ZeroDeposit();
    error InvalidFingerSlot(uint16 fingerId);
    error FingerSlotTaken(uint16 fingerId);
    error UnregisteredTerminal();
    error MerchantDisabled();
    error FingerNotRegistered(uint16 fingerId);
    error FingerBindingMismatch(uint16 suppliedFingerId, uint16 registeredFingerId);
    error InvalidChargeAmount(uint256 amount);
    error OverAllowance(uint256 allowance, uint256 requested);
    error DailyLimitExceeded(uint256 spentToday, uint256 requested);
    error NotAuthorizedToRefund();
    error AlreadyRefunded();

    struct Payment {
        address customer;
        address merchant;
        uint256 amount;
        uint64  timestamp;
        bool    refunded;
    }

    // ─── customer state ───────────────────────────────────────
    mapping(address => uint256) public balanceOf;
    mapping(address => uint16)  public fingerOf;
    mapping(uint16  => address) public ownerOfFinger;
    mapping(address => mapping(address => uint256)) public allowance; // customer => merchant
    mapping(address => uint256) public spentToday;
    mapping(address => uint256) public lastSpendDay;

    // ─── merchant state ───────────────────────────────────────
    mapping(address => uint256) public merchantBalance;
    mapping(address => address) public terminalOwner;   // terminal => merchant
    mapping(address => bool)    public isMerchant;

    Payment[] public payments;
    address public owner;

    uint256 public constant MAX_PER_TX  = 0.02 ether;
    uint256 public constant DAILY_LIMIT = 0.10 ether;

    event Deposited(address indexed customer, uint256 amount);
    event WithdrawnToWallet(address indexed who, uint256 amount);
    event FingerRegistered(address indexed customer, uint16 fingerId);
    event AllowanceSet(address indexed customer, address indexed merchant, uint256 amount);
    event TerminalRegistered(address indexed merchant, address indexed terminal);
    event Paid(uint256 indexed paymentId, address indexed customer,
               address indexed merchant, uint256 amount, uint16 fingerId);
    event Refunded(uint256 indexed paymentId, uint256 amount);

    modifier onlyOwner() {
        if (msg.sender != owner) revert NotOwner();
        _;
    }

    /// @notice Deploys the contract, making the deployer the operator.
    constructor() {
        owner = msg.sender;
    }

    // ─── operator ─────────────────────────────────────────────

    /// @notice Enables or disables an address as a merchant.
    /// @param m The address to flag.
    /// @param ok True to grant merchant status, false to revoke it.
    function setMerchant(address m, bool ok) external onlyOwner {
        isMerchant[m] = ok;
    }

    // ─── merchant ─────────────────────────────────────────────

    /// @notice Registers a terminal address under the calling merchant.
    /// @dev The terminal's own hot key signs `charge()` calls; this binding is
    ///      what bounds its authority to one merchant's allowances.
    /// @param terminal The terminal wallet address to register.
    function registerTerminal(address terminal) external {
        if (!isMerchant[msg.sender]) revert NotMerchant();
        terminalOwner[terminal] = msg.sender;
        emit TerminalRegistered(msg.sender, terminal);
    }

    /// @notice Deregisters a terminal, revoking its ability to call `charge()`.
    /// @param terminal The terminal wallet address to remove.
    function removeTerminal(address terminal) external {
        if (terminalOwner[terminal] != msg.sender) revert NotTerminalOwner();
        delete terminalOwner[terminal];
    }

    /// @notice Withdraws a merchant's accumulated payment balance to their own wallet.
    /// @param amount The amount to withdraw, in wei.
    function merchantWithdraw(uint256 amount) external {
        uint256 available = merchantBalance[msg.sender];
        if (available < amount) revert InsufficientMerchantBalance(available, amount);
        merchantBalance[msg.sender] = available - amount;
        (bool ok, ) = msg.sender.call{value: amount}("");
        if (!ok) revert TransferFailed();
        emit WithdrawnToWallet(msg.sender, amount);
    }

    // ─── customer onboarding, from their own device ───────────

    /// @notice Deposits native token into the caller's vault balance.
    function deposit() external payable {
        if (msg.value == 0) revert ZeroDeposit();
        balanceOf[msg.sender] += msg.value;
        emit Deposited(msg.sender, msg.value);
    }

    /// @notice Binds the caller's wallet to a fingerprint slot enrolled at a terminal.
    /// @dev Slot ID assigned by the sensor at enrollment. No biometric data is
    ///      transmitted or stored on-chain — only this integer.
    /// @param fingerId The sensor-assigned slot, in range [1, 200].
    function registerFinger(uint16 fingerId) external {
        if (fingerId == 0 || fingerId > 200) revert InvalidFingerSlot(fingerId);
        if (ownerOfFinger[fingerId] != address(0)) revert FingerSlotTaken(fingerId);
        uint16 old = fingerOf[msg.sender];
        if (old != 0) delete ownerOfFinger[old];
        fingerOf[msg.sender] = fingerId;
        ownerOfFinger[fingerId] = msg.sender;
        emit FingerRegistered(msg.sender, fingerId);
    }

    /// @notice Sets the caller's spending allowance for a merchant. Bounded and
    ///         revocable — set to 0 to revoke instantly.
    /// @param merchant The merchant address being granted (or revoked) an allowance.
    /// @param amount The new allowance, in wei.
    function setAllowance(address merchant, uint256 amount) external {
        allowance[msg.sender][merchant] = amount;
        emit AllowanceSet(msg.sender, merchant, amount);
    }

    /// @notice Withdraws from the caller's vault straight to their own wallet.
    /// @dev The customer's unconditional exit — bypasses every merchant and terminal.
    /// @param amount The amount to withdraw, in wei.
    function withdrawToWallet(uint256 amount) external {
        uint256 available = balanceOf[msg.sender];
        if (available < amount) revert InsufficientBalance(available, amount);
        balanceOf[msg.sender] = available - amount;
        (bool ok, ) = msg.sender.call{value: amount}("");
        if (!ok) revert TransferFailed();
        emit WithdrawnToWallet(msg.sender, amount);
    }

    // ─── the payment ──────────────────────────────────────────

    /// @notice Charges a customer, identified by fingerprint slot, on behalf of
    ///         the calling terminal's registered merchant.
    /// @dev Called by a registered terminal. Every constraint is enforced
    ///      on-chain. The terminal supplies only a fingerprint slot — it never
    ///      needs, and this function never takes, the customer's address.
    /// @param fingerId The fingerprint slot identifying the customer.
    /// @param amount The amount to charge, in wei.
    /// @return paymentId The index of the recorded payment.
    function charge(uint16 fingerId, uint256 amount) external returns (uint256 paymentId) {
        address merchant = terminalOwner[msg.sender];
        if (merchant == address(0)) revert UnregisteredTerminal();
        if (!isMerchant[merchant]) revert MerchantDisabled();

        address customer = ownerOfFinger[fingerId];
        if (customer == address(0)) revert FingerNotRegistered(fingerId);
        uint16 registeredFingerId = fingerOf[customer];
        if (registeredFingerId != fingerId) {
            revert FingerBindingMismatch(fingerId, registeredFingerId);
        }
        if (amount == 0 || amount > MAX_PER_TX) revert InvalidChargeAmount(amount);

        uint256 custBalance = balanceOf[customer];
        if (custBalance < amount) revert InsufficientBalance(custBalance, amount);

        uint256 custAllowance = allowance[customer][merchant];
        if (custAllowance < amount) revert OverAllowance(custAllowance, amount);

        uint256 today = block.timestamp / 1 days;
        if (lastSpendDay[customer] != today) {
            lastSpendDay[customer] = today;
            spentToday[customer] = 0;
        }
        uint256 spent = spentToday[customer];
        if (spent + amount > DAILY_LIMIT) revert DailyLimitExceeded(spent, amount);

        balanceOf[customer] = custBalance - amount;
        allowance[customer][merchant] = custAllowance - amount;
        spentToday[customer] = spent + amount;
        merchantBalance[merchant] += amount;

        payments.push(Payment(customer, merchant, amount, uint64(block.timestamp), false));
        paymentId = payments.length - 1;
        emit Paid(paymentId, customer, merchant, amount, fingerId);
    }

    /// @notice Refunds a payment, returning funds to the customer and restoring
    ///         the spent allowance.
    /// @dev Callable by the merchant directly or by one of their terminals.
    /// @param paymentId The index of the payment to refund.
    function refund(uint256 paymentId) external {
        Payment storage p = payments[paymentId];
        if (p.merchant != msg.sender && terminalOwner[msg.sender] != p.merchant) {
            revert NotAuthorizedToRefund();
        }
        if (p.refunded) revert AlreadyRefunded();

        uint256 available = merchantBalance[p.merchant];
        if (available < p.amount) revert InsufficientMerchantBalance(available, p.amount);

        p.refunded = true;
        merchantBalance[p.merchant] = available - p.amount;
        balanceOf[p.customer] += p.amount;
        allowance[p.customer][p.merchant] += p.amount;
        emit Refunded(paymentId, p.amount);
    }

    // ─── terminal read ────────────────────────────────────────

    /// @notice Reads everything a terminal needs to render its confirm screen.
    /// @param fingerId The fingerprint slot scanned at the terminal.
    /// @param terminal The terminal's own address.
    /// @return customer The wallet bound to `fingerId`, or the zero address if unregistered.
    /// @return bal The customer's vault balance.
    /// @return allow The customer's remaining allowance for the terminal's merchant.
    /// @return dailyLeft The customer's remaining daily spending headroom.
    function terminalView(uint16 fingerId, address terminal)
        external
        view
        returns (address customer, uint256 bal, uint256 allow, uint256 dailyLeft)
    {
        customer = ownerOfFinger[fingerId];
        if (customer == address(0)) return (address(0), 0, 0, 0);
        address merchant = terminalOwner[terminal];
        bal = balanceOf[customer];
        allow = allowance[customer][merchant];
        uint256 today = block.timestamp / 1 days;
        uint256 spent = lastSpendDay[customer] == today ? spentToday[customer] : 0;
        dailyLeft = DAILY_LIMIT > spent ? DAILY_LIMIT - spent : 0;
    }

    /// @notice Returns the total number of recorded payments.
    /// @return The length of the payments array.
    function paymentCount() external view returns (uint256) {
        return payments.length;
    }
}
