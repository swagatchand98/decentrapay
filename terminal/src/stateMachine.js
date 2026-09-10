import { ethers } from "ethers";
import QRCode from "qrcode";
import * as contractClient from "./contractClient.js";

const EXPLORER_BASE = "https://amoy.polygonscan.com";
const RECEIPT_TIMEOUT_MS = 6000;

// The exact 6 states from CLAUDE.md's transaction flow. Rejection is modeled as
// { state: "IDLE", reason }, not a 7th state, to stay faithful to that list.
export class StateMachine {
  constructor({ input, broadcast }) {
    this.input = input;
    this.broadcast = broadcast;
    this.state = "IDLE";
    this.session = null;
    this.lastScreen = { type: "SCREEN", state: "IDLE" };
  }

  getSnapshot() {
    return this.lastScreen;
  }

  emit(screen) {
    this.lastScreen = { type: "SCREEN", ...screen };
    this.broadcast(this.lastScreen);
  }

  startCharge(amountPol) {
    if (this.state !== "IDLE") return;
    if (!amountPol || Number(amountPol) <= 0) return;

    this.session = { amountPol };
    this.state = "AWAITING_CUSTOMER";
    this.input.write(`CHARGE:${amountPol}`);
    this.emit({ state: "AWAITING_CUSTOMER", amountPol });
  }

  cancel() {
    if (!["AWAITING_CUSTOMER", "IDENTIFYING", "CONFIRM"].includes(this.state)) return;
    this.input.write("IDLE");
    this.state = "IDLE";
    this.session = null;
    this.emit({ state: "IDLE" });
  }

  async handleLine(line) {
    if (line.startsWith("FINGER:")) return this.onFinger(line);
    if (line === "CONFIRM") return this.onConfirm();
    if (line === "CANCEL") return this.cancel();
  }

  async onFinger(line) {
    if (this.state !== "AWAITING_CUSTOMER") return;

    const fingerId = Number(line.slice("FINGER:".length));
    this.state = "IDENTIFYING";
    this.emit({ state: "IDENTIFYING", amountPol: this.session.amountPol, fingerId });

    let customer;
    let bal;
    let allow;
    let dailyLeft;
    try {
      [customer, bal, allow, dailyLeft] = await contractClient.terminalView(fingerId);
    } catch (err) {
      return this.reject(err.shortMessage || "Could not read chain state");
    }

    const amountWei = ethers.parseEther(this.session.amountPol);
    if (customer === ethers.ZeroAddress) return this.reject("Not registered");
    if (bal < amountWei) return this.reject("Insufficient balance");
    if (allow < amountWei) return this.reject("Limit exceeded");
    if (dailyLeft < amountWei) return this.reject("Daily limit reached");

    this.session.fingerId = fingerId;
    this.session.customer = customer;
    this.state = "CONFIRM";
    this.input.write(`ASK:${this.session.amountPol}:${ethers.formatEther(bal)}`);
    this.emit({
      state: "CONFIRM",
      amountPol: this.session.amountPol,
      fingerId,
      customer,
      balancePol: ethers.formatEther(bal),
      allowancePol: ethers.formatEther(allow),
      dailyLeftPol: ethers.formatEther(dailyLeft),
    });
  }

  async onConfirm() {
    if (this.state !== "CONFIRM") return;

    const { fingerId, amountPol } = this.session;
    this.state = "SETTLING";
    this.input.write("WAIT");
    this.emit({ state: "SETTLING", amountPol });

    try {
      const tx = await contractClient.charge(fingerId, ethers.parseEther(amountPol));
      const receipt = await tx.wait();
      const explorerUrl = `${EXPLORER_BASE}/tx/${tx.hash}`;
      const qrDataUrl = await QRCode.toDataURL(explorerUrl);

      this.input.write(`PAID:${amountPol}`);
      this.state = "RECEIPT";
      this.emit({
        state: "RECEIPT",
        amountPol,
        txHash: tx.hash,
        blockNumber: receipt.blockNumber,
        explorerUrl,
        qrDataUrl,
      });
      this.session = null;

      setTimeout(() => {
        if (this.state === "RECEIPT") {
          this.input.write("IDLE");
          this.state = "IDLE";
          this.emit({ state: "IDLE" });
        }
      }, RECEIPT_TIMEOUT_MS);
    } catch (err) {
      this.session = null;
      this.reject(err.shortMessage || err.reason || "Transaction failed");
    }
  }

  reject(reason) {
    this.input.write(`REJECT:${reason}`);
    this.state = "IDLE";
    this.session = null;
    this.emit({ state: "IDLE", reason });
  }
}
