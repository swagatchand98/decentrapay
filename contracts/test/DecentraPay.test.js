const { expect } = require("chai");
const { ethers } = require("hardhat");
const { loadFixture } = require("@nomicfoundation/hardhat-network-helpers");

const FINGER_ID = 7;
const DEPOSIT = ethers.parseEther("1");
const ALLOWANCE = ethers.parseEther("1");

async function deployFixture() {
  const [owner, merchant, terminal, customer, stranger, poorCustomer] =
    await ethers.getSigners();

  const DecentraPay = await ethers.getContractFactory("DecentraPay");
  const decentraPay = await DecentraPay.deploy();

  await decentraPay.connect(owner).setMerchant(merchant.address, true);
  await decentraPay.connect(merchant).registerTerminal(terminal.address);

  await decentraPay.connect(customer).deposit({ value: DEPOSIT });
  await decentraPay.connect(customer).registerFinger(FINGER_ID);
  await decentraPay.connect(customer).setAllowance(merchant.address, ALLOWANCE);

  const MAX_PER_TX = await decentraPay.MAX_PER_TX();
  const DAILY_LIMIT = await decentraPay.DAILY_LIMIT();

  return {
    decentraPay,
    owner,
    merchant,
    terminal,
    customer,
    stranger,
    poorCustomer,
    MAX_PER_TX,
    DAILY_LIMIT,
  };
}

describe("DecentraPay", function () {
  describe("Happy path", function () {
    it("processes a successful charge after deposit, registerFinger, and setAllowance", async function () {
      const { decentraPay, terminal, merchant, customer } = await loadFixture(deployFixture);
      const amount = ethers.parseEther("0.01");

      await expect(decentraPay.connect(terminal).charge(FINGER_ID, amount))
        .to.emit(decentraPay, "Paid")
        .withArgs(0n, customer.address, merchant.address, amount, FINGER_ID);
    });

    it("credits the merchant and decrements the customer's balance and allowance", async function () {
      const { decentraPay, terminal, merchant, customer } = await loadFixture(deployFixture);
      const amount = ethers.parseEther("0.01");

      const balBefore = await decentraPay.balanceOf(customer.address);
      const allowBefore = await decentraPay.allowance(customer.address, merchant.address);
      const merchantBefore = await decentraPay.merchantBalance(merchant.address);

      await decentraPay.connect(terminal).charge(FINGER_ID, amount);

      expect(await decentraPay.balanceOf(customer.address)).to.equal(balBefore - amount);
      expect(await decentraPay.allowance(customer.address, merchant.address)).to.equal(
        allowBefore - amount
      );
      expect(await decentraPay.merchantBalance(merchant.address)).to.equal(
        merchantBefore + amount
      );
    });

    it("returns funds to the customer via withdrawToWallet", async function () {
      const { decentraPay, customer } = await loadFixture(deployFixture);
      const withdrawAmount = ethers.parseEther("0.3");

      await expect(
        decentraPay.connect(customer).withdrawToWallet(withdrawAmount)
      ).to.changeEtherBalances([customer, decentraPay], [withdrawAmount, -withdrawAmount]);

      expect(await decentraPay.balanceOf(customer.address)).to.equal(DEPOSIT - withdrawAmount);
    });

    it("pays out the merchant via merchantWithdraw", async function () {
      const { decentraPay, terminal, merchant } = await loadFixture(deployFixture);
      const amount = ethers.parseEther("0.01");
      await decentraPay.connect(terminal).charge(FINGER_ID, amount);

      await expect(
        decentraPay.connect(merchant).merchantWithdraw(amount)
      ).to.changeEtherBalances([merchant, decentraPay], [amount, -amount]);

      expect(await decentraPay.merchantBalance(merchant.address)).to.equal(0n);
    });

    it("reverses balances and restores the allowance on refund", async function () {
      const { decentraPay, terminal, merchant, customer } = await loadFixture(deployFixture);
      const amount = ethers.parseEther("0.01");

      const balBefore = await decentraPay.balanceOf(customer.address);
      const allowBefore = await decentraPay.allowance(customer.address, merchant.address);

      await decentraPay.connect(terminal).charge(FINGER_ID, amount);
      const paymentId = (await decentraPay.paymentCount()) - 1n;

      await expect(decentraPay.connect(merchant).refund(paymentId))
        .to.emit(decentraPay, "Refunded")
        .withArgs(paymentId, amount);

      expect(await decentraPay.balanceOf(customer.address)).to.equal(balBefore);
      expect(await decentraPay.allowance(customer.address, merchant.address)).to.equal(allowBefore);
      expect(await decentraPay.merchantBalance(merchant.address)).to.equal(0n);
      expect((await decentraPay.payments(paymentId)).refunded).to.equal(true);
    });
  });

  describe("Rejections", function () {
    it("reverts on charge from an unregistered terminal", async function () {
      const { decentraPay, stranger } = await loadFixture(deployFixture);
      await expect(
        decentraPay.connect(stranger).charge(FINGER_ID, ethers.parseEther("0.01"))
      ).to.be.revertedWithCustomError(decentraPay, "UnregisteredTerminal");
    });

    it("reverts on charge with a fingerId bound to nobody", async function () {
      const { decentraPay, terminal } = await loadFixture(deployFixture);
      const unknownFinger = 99;
      await expect(
        decentraPay.connect(terminal).charge(unknownFinger, ethers.parseEther("0.01"))
      )
        .to.be.revertedWithCustomError(decentraPay, "FingerNotRegistered")
        .withArgs(unknownFinger);
    });

    it("reverts on charge above MAX_PER_TX", async function () {
      const { decentraPay, terminal, MAX_PER_TX } = await loadFixture(deployFixture);
      const amount = MAX_PER_TX + 1n;
      await expect(decentraPay.connect(terminal).charge(FINGER_ID, amount))
        .to.be.revertedWithCustomError(decentraPay, "InvalidChargeAmount")
        .withArgs(amount);
    });

    it("reverts on charge above the customer's allowance", async function () {
      const { decentraPay, terminal, merchant, customer } = await loadFixture(deployFixture);
      const smallAllowance = ethers.parseEther("0.005");
      const amount = ethers.parseEther("0.01");
      await decentraPay.connect(customer).setAllowance(merchant.address, smallAllowance);

      await expect(decentraPay.connect(terminal).charge(FINGER_ID, amount))
        .to.be.revertedWithCustomError(decentraPay, "OverAllowance")
        .withArgs(smallAllowance, amount);
    });

    it("reverts on charge above the customer's balance", async function () {
      const { decentraPay, merchant, terminal, poorCustomer } = await loadFixture(deployFixture);
      const poorFinger = 8;
      await decentraPay.connect(poorCustomer).registerFinger(poorFinger);
      await decentraPay.connect(poorCustomer).setAllowance(merchant.address, ethers.parseEther("1"));
      const amount = ethers.parseEther("0.01");

      await expect(decentraPay.connect(terminal).charge(poorFinger, amount))
        .to.be.revertedWithCustomError(decentraPay, "InsufficientBalance")
        .withArgs(0n, amount);
    });

    it("reverts on a charge that would breach DAILY_LIMIT", async function () {
      const { decentraPay, terminal, MAX_PER_TX, DAILY_LIMIT } = await loadFixture(deployFixture);
      const chargesToLimit = DAILY_LIMIT / MAX_PER_TX; // exact: 5n
      for (let i = 0n; i < chargesToLimit; i++) {
        await decentraPay.connect(terminal).charge(FINGER_ID, MAX_PER_TX);
      }
      const overflow = ethers.parseEther("0.01");
      await expect(decentraPay.connect(terminal).charge(FINGER_ID, overflow))
        .to.be.revertedWithCustomError(decentraPay, "DailyLimitExceeded")
        .withArgs(DAILY_LIMIT, overflow);
    });

    it("reverts on a second charge after the customer sets allowance to 0", async function () {
      const { decentraPay, terminal, merchant, customer } = await loadFixture(deployFixture);
      const amount = ethers.parseEther("0.01");
      await decentraPay.connect(terminal).charge(FINGER_ID, amount);
      await decentraPay.connect(customer).setAllowance(merchant.address, 0n);

      await expect(decentraPay.connect(terminal).charge(FINGER_ID, amount))
        .to.be.revertedWithCustomError(decentraPay, "OverAllowance")
        .withArgs(0n, amount);
    });

    it("reverts when refunding the same payment twice", async function () {
      const { decentraPay, terminal, merchant } = await loadFixture(deployFixture);
      const amount = ethers.parseEther("0.01");
      await decentraPay.connect(terminal).charge(FINGER_ID, amount);
      const paymentId = (await decentraPay.paymentCount()) - 1n;
      await decentraPay.connect(merchant).refund(paymentId);

      await expect(
        decentraPay.connect(merchant).refund(paymentId)
      ).to.be.revertedWithCustomError(decentraPay, "AlreadyRefunded");
    });

    it("reverts when refund is called by someone who isn't the merchant", async function () {
      const { decentraPay, terminal, stranger } = await loadFixture(deployFixture);
      const amount = ethers.parseEther("0.01");
      await decentraPay.connect(terminal).charge(FINGER_ID, amount);
      const paymentId = (await decentraPay.paymentCount()) - 1n;

      await expect(
        decentraPay.connect(stranger).refund(paymentId)
      ).to.be.revertedWithCustomError(decentraPay, "NotAuthorizedToRefund");
    });
  });

  describe("Edge cases", function () {
    it("resets the daily limit after 24 hours", async function () {
      const { decentraPay, terminal, MAX_PER_TX, DAILY_LIMIT } = await loadFixture(deployFixture);
      const chargesToLimit = DAILY_LIMIT / MAX_PER_TX;
      for (let i = 0n; i < chargesToLimit; i++) {
        await decentraPay.connect(terminal).charge(FINGER_ID, MAX_PER_TX);
      }
      await expect(
        decentraPay.connect(terminal).charge(FINGER_ID, MAX_PER_TX)
      ).to.be.revertedWithCustomError(decentraPay, "DailyLimitExceeded");

      await ethers.provider.send("evm_increaseTime", [24 * 60 * 60]);
      await ethers.provider.send("evm_mine", []);

      await expect(decentraPay.connect(terminal).charge(FINGER_ID, MAX_PER_TX)).to.emit(
        decentraPay,
        "Paid"
      );
    });

    it("reverts registerFinger on an already-taken slot", async function () {
      const { decentraPay, stranger } = await loadFixture(deployFixture);
      await expect(decentraPay.connect(stranger).registerFinger(FINGER_ID))
        .to.be.revertedWithCustomError(decentraPay, "FingerSlotTaken")
        .withArgs(FINGER_ID);
    });

    it("frees the customer's old slot when they register a new one", async function () {
      const { decentraPay, customer, stranger } = await loadFixture(deployFixture);
      const newFinger = 8;

      await decentraPay.connect(customer).registerFinger(newFinger);

      expect(await decentraPay.ownerOfFinger(FINGER_ID)).to.equal(ethers.ZeroAddress);
      expect(await decentraPay.ownerOfFinger(newFinger)).to.equal(customer.address);
      expect(await decentraPay.fingerOf(customer.address)).to.equal(newFinger);

      await expect(decentraPay.connect(stranger).registerFinger(FINGER_ID)).to.not.be.reverted;
    });

    it("reverts withdrawToWallet for more than the balance", async function () {
      const { decentraPay, customer } = await loadFixture(deployFixture);
      const tooMuch = DEPOSIT + 1n;
      await expect(decentraPay.connect(customer).withdrawToWallet(tooMuch))
        .to.be.revertedWithCustomError(decentraPay, "InsufficientBalance")
        .withArgs(DEPOSIT, tooMuch);
    });
  });
});
