# DecentraPay — Build Specification

**Pay with your finger. No card. No PIN. No phone. No bank.**

A merchant point-of-sale terminal that settles payments on a public blockchain, where the customer's identity is a fingerprint bound on-chain to their wallet.

---

## 1. What we are building

A small terminal that sits on a shop counter.

- The merchant enters an amount.
- The customer places a finger.
- The terminal resolves who they are **from the blockchain**, shows them the amount and their balance.
- They press CONFIRM. Funds move from their vault to the merchant's, on-chain, in about two seconds.
- A receipt appears with a QR code to the transaction on a public block explorer.

The customer carries nothing. No card, no phone, no app, no PIN. Their money lives in a smart contract they alone control — not in a bank, and not in our machine.

**Abstract sentence:** A point-of-sale terminal in which customer identity is resolved on-chain from a biometric binding and payment is authorized by a smart contract granting the merchant a revocable, bounded spending allowance — enabling card-free, phone-free, bank-free retail payment without ever exposing the customer's private key.

---

## 2. Why this is a real product

This is the part that makes the project defensible as more than a class exercise.

| | Card terminal today | DecentraPay |
|---|---|---|
| Merchant hardware | ₹3,000–8,000 POS device | ₹3,000 terminal |
| Merchant fee (MDR) | ~1–2% of every sale | Network gas, a fraction of a rupee |
| Settlement time | T+1 to T+2 days | ~2 seconds, final |
| Customer needs | Card or smartphone | Nothing |
| Chargeback risk | Merchant bears it | None — settlement is final |
| Requires a bank account | Yes, both sides | No |

A small merchant paying 1.5% MDR on ₹2 lakh of monthly sales loses ₹3,000 a month. That is the entire cost of the terminal, every month. **That number is your best slide.**

And "the customer needs nothing" is the genuine inclusion argument — it targets people without smartphones, which is exactly the population every fintech inclusion pitch claims to serve and almost none actually reach.

---

## 3. The central design problem, and the answer

To move funds out of a wallet, **something must sign with the private key.** The customer brings no device, so the terminal must sign. The terminal therefore needs some authority over the customer's money. The whole security design is about bounding that authority.

### What we will never build

**A screen that asks for a seed phrase or private key.** Every crypto scam terminal works this way. The customer's private key must never touch this machine, in any form, at any point. If a team member proposes it "just for testing," this section is the answer.

### What we build instead: pre-authorized allowance

This is exactly how a contactless card already works. In India, a contactless card pays up to ₹5,000 without a PIN — the card doesn't carry authority over your net worth, it draws on a limit you established beforehand.

**Step 1 — One-time setup, from any browser on any device the customer already owns:**

| Action | Effect |
|---|---|
| `deposit()` | Funds enter the vault. Still theirs — withdrawable to their own wallet any time. |
| `registerFinger(slotId)` | Binds their wallet to a fingerprint slot enrolled at a terminal. |
| `setAllowance(merchant, amount)` | Grants that merchant a bounded, revocable spending limit. |

**Step 2 — Every purchase thereafter: finger, confirm, done.**

> This one-time setup is the direct analogue of opening a bank account before using a card. Frame it that way, not as a limitation.

### Security model — memorize this

| Property | Guarantee |
|---|---|
| Private key exposure | **Zero.** Never leaves the customer's own device. |
| Terminal or merchant compromise | Attacker takes at most the **outstanding allowances** — never a customer's wallet. |
| Customer revocation | `setAllowance(merchant, 0)` from their own wallet, instantly. |
| Operator revocation | Contract owner deregisters a stolen terminal. |
| Per-transaction cap | Enforced on-chain, independent of allowance. |
| Daily cap | Enforced on-chain, per customer. |
| Wrong finger | Contract rejects — the binding is on-chain, not in firmware. |
| Customer always has an exit | `withdrawToWallet()` bypasses every merchant and terminal. |

The honest sentence for the viva: *"The terminal holds a hot key with a spending limit. That is a real risk. We bound it explicitly on-chain rather than pretending it doesn't exist."* Examiners respect this far more than a claim of perfect security.

---

## 4. Architecture

```
┌──────────────────────── THE TERMINAL ────────────────────────┐
│                                                              │
│  ┌─────────────────────────┐      ┌───────────────────────┐  │
│  │  Terminal computer      │ USB  │  ESP32 peripheral MCU │  │
│  │  (laptop, kiosk mode)   │◄────►│                       │  │
│  │                         │serial│  · Fingerprint sensor │  │
│  │  · React POS UI         │      │  · Customer OLED      │  │
│  │  · Node.js signer       │      │  · Confirm / Cancel   │  │
│  │  · Terminal private key │      │  · Buzzer             │  │
│  └──────────┬──────────────┘      └───────────────────────┘  │
└─────────────┼────────────────────────────────────────────────┘
              │ HTTPS
              ▼
   ┌────────────────────────────────────────┐
   │   DecentraPay.sol  ·  Polygon Amoy     │
   │   vault · identity · allowances        │
   └────────────────────────────────────────┘
```

**The laptop is the terminal computer.** In production this is an embedded SBC; for the prototype it's a laptop in Chromium kiosk mode inside an enclosure. Say this plainly in the report — standard prototype practice.

**The ESP32 is a peripheral controller.** No networking, no crypto, no chain access. It reads fingers, reports slot numbers over serial, drives the customer-facing display and buttons. About 130 lines of firmware.

**Two-screen design, which is what makes it feel like a real POS:**
- **Merchant screen** (laptop): amount entry, transaction log, daily total
- **Customer screen** (OLED on the device): the amount being charged, their balance, confirm prompt

The customer never touches the merchant's computer. That separation is worth building — it's the difference between a demo and a product.

---

## 5. Hardware — ₹2,395

| Item | Qty | ₹ | Role |
|---|---|---|---|
| ESP32 DevKit V1 | 1 | 450 | Peripheral controller |
| AS608 / R307 fingerprint module | 1 | 1,200 | Customer identity |
| SSD1306 OLED 0.96" I2C | 1 | 250 | Customer-facing display |
| Tactile buttons (green/red) | 2 | 20 | Confirm / Cancel |
| Passive buzzer | 1 | 20 | Feedback |
| Breadboard + jumpers | 1 | 150 | — |
| Spare ESP32 | 1 | 450 | **Buy it.** |
| Laptop | 1 | 0 | You own one |
| Enclosure materials | — | ~150 | Cardboard, paint |
| **Total** | | **~2,690** | (₹2,240 without spare) |

A 1.3" or 1.5" OLED (₹400) is worth the upgrade if budget allows — the customer needs to read an amount from arm's length.

### Wiring

| ESP32 | To | Note |
|---|---|---|
| GPIO 16 (RX2) | Sensor **TX** | Crossed. Always. |
| GPIO 17 (TX2) | Sensor **RX** | |
| 3V3 | Sensor VCC | Check your module — a few want 5V power, 3.3V logic |
| GPIO 21 / 22 | OLED SDA / SCL | Address usually 0x3C |
| GPIO 25 | Confirm button | `INPUT_PULLUP`, other leg to GND |
| GPIO 26 | Cancel button | `INPUT_PULLUP` |
| GPIO 14 | Buzzer | |
| GND | Everything | Common ground |

No servo means **no brownout problem** — the whole thing runs happily off laptop USB. One of the quiet wins of dropping cash dispensing.

---

## 6. Software stack

| Layer | Choice | Why |
|---|---|---|
| Chain | Polygon Amoy testnet (80002) | Free tokens, ~2s blocks |
| Contract | Solidity ^0.8.20, single file | Jury-readable in five minutes |
| Deploy | Remix IDE | No toolchain to install |
| POS UI | React + Vite, Chromium kiosk mode | Fullscreen, touch-friendly |
| Signer | Node.js + ethers v6 + `serialport` | Signing is three lines here, three days on an ESP32 |
| Firmware | Arduino, `Adafruit_Fingerprint` | Serial only |

```bash
chromium --kiosk --incognito http://localhost:5173
```

---

## 7. Transaction flow

```
IDLE
  Merchant screen:  [ amount keypad ]        Customer OLED:  "DecentraPay"
      │
      ▼  merchant enters ₹250, presses CHARGE
AWAITING CUSTOMER
  Merchant:  "Waiting for customer…"         OLED:  "₹250 — Place finger"
      │
      ▼  customer scans          ESP32 → FINGER:7
IDENTIFYING
  Node calls terminalView(7, terminalAddr) → wallet, balance, allowance, daily left
      │
      ├─ unknown finger ─────────► OLED "Not registered", buzzer ×2, back to IDLE
      ├─ insufficient balance ───► OLED "Insufficient balance"
      ├─ over allowance ─────────► OLED "Limit exceeded"
      │
      ▼  all checks pass
CONFIRM
  Merchant:  "0x1a2b…9f4c · balance 0.084"   OLED:  "Pay ₹250?
                                                     Balance 0.084
                                                     GREEN = yes"
      │
      ▼  customer presses GREEN     ESP32 → CONFIRM
SETTLING
  Node signs charge(7, amount) → broadcasts
  Merchant:  "Settling… 0x8f3a…"             OLED:  "Processing…"
      │
      ▼  confirmed
RECEIPT
  Merchant:  "PAID ₹250 · block 8,421,993 · [QR]"
  OLED:      "PAID ₹250 · Thank you"          buzzer ×1
      │
      ▼  6 second timeout
IDLE
```

**The customer presses a physical button on their side of the device** — never the merchant's screen. This is a small detail that makes the whole thing read as a real payment terminal rather than a student project.

---

## 8. Smart contract

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/// @title DecentraPay — biometric-identity point of sale with bounded terminal authority
contract DecentraPay {

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

    modifier onlyOwner() { require(msg.sender == owner, "not owner"); _; }
    constructor() { owner = msg.sender; }

    // ─── operator ─────────────────────────────────────────────
    function setMerchant(address m, bool ok) external onlyOwner { isMerchant[m] = ok; }

    // ─── merchant ─────────────────────────────────────────────
    function registerTerminal(address terminal) external {
        require(isMerchant[msg.sender], "not a merchant");
        terminalOwner[terminal] = msg.sender;
        emit TerminalRegistered(msg.sender, terminal);
    }

    function removeTerminal(address terminal) external {
        require(terminalOwner[terminal] == msg.sender, "not yours");
        delete terminalOwner[terminal];
    }

    function merchantWithdraw(uint256 amount) external {
        require(merchantBalance[msg.sender] >= amount, "insufficient");
        merchantBalance[msg.sender] -= amount;
        (bool ok,) = msg.sender.call{value: amount}("");
        require(ok, "send failed");
        emit WithdrawnToWallet(msg.sender, amount);
    }

    // ─── customer onboarding, from their own device ───────────

    function deposit() external payable {
        require(msg.value > 0, "zero");
        balanceOf[msg.sender] += msg.value;
        emit Deposited(msg.sender, msg.value);
    }

    /// Slot ID assigned by the sensor at enrollment.
    /// No biometric data is transmitted or stored — only this integer.
    function registerFinger(uint16 fingerId) external {
        require(fingerId > 0 && fingerId <= 200, "bad slot");
        require(ownerOfFinger[fingerId] == address(0), "slot taken");
        uint16 old = fingerOf[msg.sender];
        if (old != 0) delete ownerOfFinger[old];
        fingerOf[msg.sender]    = fingerId;
        ownerOfFinger[fingerId] = msg.sender;
        emit FingerRegistered(msg.sender, fingerId);
    }

    /// Bounded and revocable. Set to 0 to revoke instantly.
    function setAllowance(address merchant, uint256 amount) external {
        allowance[msg.sender][merchant] = amount;
        emit AllowanceSet(msg.sender, merchant, amount);
    }

    /// The customer can always exit, bypassing every merchant and terminal.
    function withdrawToWallet(uint256 amount) external {
        require(balanceOf[msg.sender] >= amount, "insufficient");
        balanceOf[msg.sender] -= amount;
        (bool ok,) = msg.sender.call{value: amount}("");
        require(ok, "send failed");
        emit WithdrawnToWallet(msg.sender, amount);
    }

    // ─── the payment ──────────────────────────────────────────

    /// Called by a registered terminal. Every constraint enforced on-chain.
    /// The terminal supplies only a fingerprint slot — it never needs the customer's address.
    function charge(uint16 fingerId, uint256 amount) external returns (uint256 paymentId) {
        address merchant = terminalOwner[msg.sender];
        require(merchant != address(0),               "unregistered terminal");
        require(isMerchant[merchant],                 "merchant disabled");

        address customer = ownerOfFinger[fingerId];
        require(customer != address(0),               "finger not registered");
        require(fingerOf[customer] == fingerId,       "binding mismatch");
        require(amount > 0 && amount <= MAX_PER_TX,   "over per-tx cap");
        require(balanceOf[customer] >= amount,        "insufficient balance");
        require(allowance[customer][merchant] >= amount, "over allowance");

        uint256 today = block.timestamp / 1 days;
        if (lastSpendDay[customer] != today) {
            lastSpendDay[customer] = today;
            spentToday[customer]   = 0;
        }
        require(spentToday[customer] + amount <= DAILY_LIMIT, "daily limit");

        balanceOf[customer]                -= amount;
        allowance[customer][merchant]      -= amount;
        spentToday[customer]               += amount;
        merchantBalance[merchant]          += amount;

        payments.push(Payment(customer, merchant, amount, uint64(block.timestamp), false));
        paymentId = payments.length - 1;
        emit Paid(paymentId, customer, merchant, amount, fingerId);
    }

    /// Merchants can refund. Real POS terminals do this; it costs us ten lines.
    function refund(uint256 paymentId) external {
        Payment storage p = payments[paymentId];
        require(p.merchant == msg.sender || terminalOwner[msg.sender] == p.merchant, "not yours");
        require(!p.refunded, "already refunded");
        require(merchantBalance[p.merchant] >= p.amount, "merchant underfunded");

        p.refunded = true;
        merchantBalance[p.merchant] -= p.amount;
        balanceOf[p.customer]       += p.amount;
        allowance[p.customer][p.merchant] += p.amount;
        emit Refunded(paymentId, p.amount);
    }

    // ─── terminal read ────────────────────────────────────────

    /// One call to render the confirm screen.
    function terminalView(uint16 fingerId, address terminal)
        external view
        returns (address customer, uint256 bal, uint256 allow, uint256 dailyLeft)
    {
        customer = ownerOfFinger[fingerId];
        if (customer == address(0)) return (address(0), 0, 0, 0);
        address merchant = terminalOwner[terminal];
        bal   = balanceOf[customer];
        allow = allowance[customer][merchant];
        uint256 today = block.timestamp / 1 days;
        uint256 spent = lastSpendDay[customer] == today ? spentToday[customer] : 0;
        dailyLeft = DAILY_LIMIT > spent ? DAILY_LIMIT - spent : 0;
    }

    function paymentCount() external view returns (uint256) { return payments.length; }
}
```

### Design points for the viva

- **The terminal never learns the customer's address until the chain tells it.** `charge()` takes a fingerprint slot, not a wallet. Identity resolution is an on-chain operation.
- **The binding is re-verified inside `charge()`.** A terminal with reflashed firmware still cannot bill the wrong account.
- **Three independent ceilings:** allowance, per-transaction cap, daily cap. Defence in depth.
- **`withdrawToWallet` is what makes this genuinely non-custodial.** The customer can always exit to their own wallet, bypassing every merchant. Without it, this is custody with extra steps.
- **The terminal's key can move money but cannot create it,** cannot raise its own allowance, cannot rebind a finger, and cannot touch a customer who hasn't authorized its merchant.

---

## 9. Node.js terminal service

```js
const wallet   = new ethers.Wallet(process.env.TERMINAL_KEY, provider);
const contract = new ethers.Contract(ADDR, ABI, wallet);

let session = null;   // { amount } set when the merchant presses CHARGE

port.on('data', async (line) => {
  const msg = line.toString().trim();

  if (msg.startsWith('FINGER:') && session) {
    const fingerId = Number(msg.slice(7));
    const [customer, bal, allow, dailyLeft] =
          await contract.terminalView(fingerId, wallet.address);

    if (customer === ethers.ZeroAddress) return reject('Not registered');
    if (bal   < session.amount)          return reject('Insufficient balance');
    if (allow < session.amount)          return reject('Limit exceeded');
    if (dailyLeft < session.amount)      return reject('Daily limit reached');

    session.fingerId = fingerId;
    session.customer = customer;
    ui.send({ screen: 'CONFIRM', customer, bal, amount: session.amount });
    port.write(`ASK:${fmt(session.amount)}:${fmt(bal)}\n`);
  }

  if (msg === 'CONFIRM' && session?.fingerId) {
    const tx = await contract.charge(session.fingerId, session.amount);
    ui.send({ screen: 'SETTLING', hash: tx.hash });
    port.write('WAIT\n');
    const receipt = await tx.wait();
    port.write(`PAID:${fmt(session.amount)}\n`);
    ui.send({ screen: 'RECEIPT', hash: tx.hash, block: receipt.blockNumber });
    session = null;
  }

  if (msg === 'CANCEL') { session = null; port.write('IDLE\n'); ui.send({ screen: 'IDLE' }); }
});
```

The terminal key lives in a gitignored `.env`. It is a hot key on a demo machine — say so, and point at the allowance model as the mitigation.

---

## 10. Firmware — about 130 lines

No WiFi, no HTTPS, no crypto, no hex parsing.

```cpp
void loop() {
  // commands from the terminal computer
  if (Serial.available()) {
    String cmd = Serial.readStringUntil('\n'); cmd.trim();
    if      (cmd.startsWith("ASK:"))   { showAsk(cmd); state = ASKING; }
    else if (cmd.startsWith("PAID:"))  { showPaid(cmd); beep(1); state = DONE; }
    else if (cmd.startsWith("CHARGE:")){ showAmount(cmd); state = WAIT_FINGER; }
    else if (cmd.startsWith("REJECT:")){ showError(cmd); beep(2); state = IDLE; }
    else if (cmd == "WAIT")            { oled("Processing..."); }
    else if (cmd == "IDLE")            { oled("DecentraPay"); state = IDLE; }
  }

  // scan for a finger only while a charge is pending
  if (state == WAIT_FINGER) {
    int id = getFingerprintID();
    if (id > 0) { beep(1); Serial.printf("FINGER:%d\n", id); oled("Identifying..."); }
  }

  // customer buttons
  if (state == ASKING) {
    if (pressed(BTN_CONFIRM)) Serial.println("CONFIRM");
    if (pressed(BTN_CANCEL))  { Serial.println("CANCEL"); beep(2); }
  }
  delay(50);
}
```

### Sensor gotchas that cost days

- `HardwareSerial(2)` at **57600 baud**, GPIO16/17. Not SoftwareSerial — it's unreliable on ESP32 at this rate.
- **TX↔RX crossed.** Every "it returns 0x00" is this.
- Enrollment needs two scans of the same finger, lifted between. Run Adafruit's stock `enroll` example unmodified before writing anything.
- **Enroll two fingers per person.** Index fingers get dry, cold, or dirty. A backup thumb has rescued many demos.
- Templates persist in the sensor's own flash across ESP32 reflashes.
- Test under the actual demo lighting. Optical sensors dislike direct sunlight.
- Debounce the buttons — 50 ms is plenty, and without it one press registers as four.

---

## 11. Fourteen-day plan

Four parallel tracks converging on Day 9.

| Day | Contract (A) | POS UI (B) | Firmware (C) | Node + integration (D) |
|---|---|---|---|---|
| 1 | Remix, Amoy, faucet | Vite + React skeleton | Blink, serial echo | Repo, order hardware |
| 2 | Write contract | Merchant keypad screen | **Stock enroll example** | Node + ethers reach the chain |
| 3 | Deploy + verify | Confirm + settling screens | Match returns slot ID | `serialport` reads ESP32 |
| 4 | Test every function | Receipt screen + QR | OLED customer screens | `terminalView` working |
| 5 | Allowances, caps, refund | Kiosk styling, fullscreen | Buttons + buzzer + debounce | `charge()` signs and sends |
| 6 | Customer onboarding page | Transaction log + daily total | Serial state machine | Screen state machine |
| 7–8 | Buffer / assist | Polish | Reliability, reconnect | Wire UI ↔ Node ↔ serial |
| **9** | **All hands — first end-to-end payment** | | | |
| 10 | Fix what broke | | | Enclosure build |
| 11 | 20 consecutive clean runs, logged | | | Record demo video |
| 12 | Failure demos: wrong finger, over-limit, revoked allowance, refund | | | Screenshots, results table |
| 13 | Enroll-a-juror mode | | | Report + slides |
| 14 | **Freeze code.** Viva drill. Rehearse three times. | | | |

**Day 9 is the checkpoint.** If nothing has spoken to anything else by then, cut to the fallback.

### Fallback: 5-day minimum viable

Cut in this order:

1. Onboarding page — do deposits, registration, allowances from Remix directly
2. Refunds, transaction log, QR, buzzer
3. Physical buttons → confirm on the merchant screen
4. Enclosure → bare breadboard

Irreducible core: **merchant enters an amount → customer places a finger → the chain identifies them → they confirm → a real transaction settles → receipt.** That, live, beats a feature-complete project that doesn't run.

---

## 12. Low-effort, high-value additions

| Feature | Effort | Payoff |
|---|---|---|
| **QR of the tx hash on the receipt** | ~20 lines | A juror scans it and sees a real transaction on a public chain. Best value in the project. |
| **"Revoke this merchant" live demo** | Free — already in the contract | Pay successfully, revoke the allowance from a phone, watch the next payment rejected on-chain. **Your strongest security moment.** |
| **Enroll a juror live** | Already written | Thirty seconds. Turns a demo into an experience. |
| **Refund button** | ~15 lines | Real POS feature. Makes the product feel complete rather than a proof of concept. |
| **Daily sales total on the merchant screen** | ~20 lines, `queryFilter` | Reads past `Paid` events. Looks like software a shop would actually run. |
| **MDR savings counter** | ~5 lines | "You saved ₹X in card fees today." Ties the demo directly to your business case. |
| **Buzzer feedback** | 5 lines | One beep accept, two beeps reject. Feels finished. |
| **Demo-mode escape hatch** | 3 lines | Serial command skips the sensor. Never mention it unless the sensor fails. |

The MDR savings counter is disproportionately effective. It converts an abstract fee argument into a number ticking upward on screen while the jury watches.

---

## 13. Known limitations — declare these yourselves

1. **The terminal holds a hot key.** Bounded by allowance, per-transaction and daily caps, revocable by both customer and operator. Real mitigation is a hardware secure element or threshold signing.
2. **No liveness detection.** Optical sensors can be defeated by a lifted print with effort. Mitigation: capacitive or liveness-capable sensor, or a second factor above a threshold amount.
3. **One-time onboarding needs a user device.** The analogue of opening a bank account. Unavoidable without asking customers to type private keys into a machine, which we refuse to do.
4. **Fingerprint slots are a finite shared namespace** (1–200), first-come-first-served on-chain. Production needs per-terminal namespacing or a hashed identifier scheme.
5. **Volatile settlement asset.** A merchant paid in a fluctuating token carries price risk. Stablecoin denomination is the fix and is listed as future work.
6. **Terminal computer is a laptop.** Production is an embedded SBC in a tamper-evident enclosure.
7. **RPC endpoint is a liveness dependency.** It can deny service; it cannot forge a payment.
8. **Testnet, unaudited, no KYC/AML.** Crypto is not legal tender in India, and merchant crypto acceptance faces significant regulatory questions under current RBI and FEMA frameworks. This is a research prototype.

A limitations section this specific reads as competence. One claiming none reads as untested.

---

## 14. Viva preparation

Every member should be able to answer all of these.

- **"Does the terminal see my private key?"** — Never. It cannot. It holds its own key with a spending limit you granted and can revoke instantly from your own wallet.
- **"So it's custodial?"** — No. Funds sit in a contract only you fully control. `withdrawToWallet` lets you exit bypassing every merchant. The merchant has a bounded allowance, not custody.
- **"What if the terminal is stolen?"** — It gets a key that can spend up to the outstanding allowances of customers who opted in to that merchant, and the operator deregisters it. No one's wallet is reachable.
- **"What if my fingerprint isn't recognised?"** — `withdrawToWallet` from your own device. The biometric is a terminal convenience, never the only path to your funds. **A system where a failed scan traps your money is broken.**
- **"How is this better than UPI?"** — For the customer with a smartphone, honestly, it usually isn't; UPI is excellent. Our claim is narrower: no smartphone required, no bank account required, no MDR for the merchant, and instant final settlement. That combination doesn't exist today.
- **"Why blockchain and not a database?"** — Because a database needs an operator, and an operator needs to be trusted with custody and licensed to hold funds. The contract removes both. That's the whole argument.
- **"Someone could copy my fingerprint."** — Yes. That's why the finger is an identity lookup with hard spending caps, not a signing key. The worst case is bounded by the allowance, and you can revoke it in one transaction.
- **"Is this legal in India?"** — Not deployable today. Technical proof of concept. Saying this first is a strength, not a weakness.

---

## 15. Future work

- **Stablecoin settlement** (test USDC on Amoy) — removes merchant price risk. Highest-value next step.
- ERC-4337 session keys, replacing allowances with expiring scoped permissions
- Hardware secure element (ATECC608A, ~₹200) for the terminal key
- Liveness-capable sensor; second factor above a threshold amount
- Multi-merchant network with a shared terminal fleet and per-merchant caps
- Offline pre-authorized vouchers for low-connectivity retail
- Fiat off-ramp for merchants via a licensed partner — the realistic path to deployment

---

## Quick reference

**Polygon Amoy** · RPC `https://rpc-amoy.polygon.technology` · Chain ID `80002` · POL

**Kiosk:** `chromium --kiosk --incognito http://localhost:5173`

**Node:** `npm i ethers@6 serialport qrcode`

**Firmware libs:** `Adafruit_Fingerprint`, `Adafruit_SSD1306`, `Adafruit_GFX`

**Sensor:** `HardwareSerial(2)`, GPIO16/17, 57600 baud, TX↔RX crossed

**Never:** ask the customer for a seed phrase or private key. Not on a screen, not on paper, not "just for testing."