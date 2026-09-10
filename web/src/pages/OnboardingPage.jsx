import { useState } from "react";
import { ethers } from "ethers";
import { connectWallet, describeError, getReadContract } from "../lib/contract.js";

function useOnboardingState() {
  const [wallet, setWallet] = useState(null);
  const [status, setStatus] = useState({ balancePol: null, fingerId: null });
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function refreshStatus(address) {
    const readContract = getReadContract();
    const [balance, fingerId] = await Promise.all([
      readContract.balanceOf(address),
      readContract.fingerOf(address),
    ]);
    setStatus({ balancePol: ethers.formatEther(balance), fingerId: Number(fingerId) });
  }

  async function connect() {
    setError("");
    setBusy(true);
    try {
      const w = await connectWallet();
      setWallet(w);
      await refreshStatus(w.address);
    } catch (err) {
      setError(describeError(err));
    } finally {
      setBusy(false);
    }
  }

  async function runAction(fn) {
    if (!wallet) return;
    setError("");
    setBusy(true);
    try {
      const tx = await fn();
      await tx.wait();
      await refreshStatus(wallet.address);
    } catch (err) {
      setError(describeError(err));
    } finally {
      setBusy(false);
    }
  }

  return { wallet, status, error, busy, connect, runAction };
}

export default function OnboardingPage() {
  const { wallet, status, error, busy, connect, runAction } = useOnboardingState();

  const [depositAmount, setDepositAmount] = useState("0.05");
  const [fingerId, setFingerId] = useState("1");
  const [merchantAddress, setMerchantAddress] = useState("");
  const [allowanceAmount, setAllowanceAmount] = useState("0.05");
  const [withdrawAmount, setWithdrawAmount] = useState("");

  if (!wallet) {
    return (
      <div className="page">
        <h1>DecentraPay</h1>
        <p>Connect your wallet to deposit, register a finger, and set merchant allowances.</p>
        <button onClick={connect} disabled={busy} style={{ maxWidth: 260 }}>
          {busy ? "Connecting..." : "Connect Wallet"}
        </button>
        {error && <p className="reason">{error}</p>}
      </div>
    );
  }

  return (
    <div className="page">
      <h1>DecentraPay — Customer Onboarding</h1>

      <div className="card">
        <div className="stat">
          <span>Address</span>
          <span>
            {wallet.address.slice(0, 6)}...{wallet.address.slice(-4)}
          </span>
        </div>
        <div className="stat">
          <span>Vault balance</span>
          <span>{status.balancePol ?? "…"} POL</span>
        </div>
        <div className="stat">
          <span>Registered finger</span>
          <span>{status.fingerId ? status.fingerId : "none"}</span>
        </div>
      </div>

      <div className="card">
        <h2>Deposit</h2>
        <input value={depositAmount} onChange={(e) => setDepositAmount(e.target.value)} placeholder="Amount in POL" />
        <button
          disabled={busy}
          onClick={() => runAction(() => wallet.writeContract.deposit({ value: ethers.parseEther(depositAmount) }))}
        >
          Deposit
        </button>
      </div>

      <div className="card">
        <h2>Register Finger</h2>
        <p>
          In real use this slot number comes from enrolling at a terminal. For testing without hardware, pick
          any unused integer 1–200.
        </p>
        <input
          type="number"
          min="1"
          max="200"
          value={fingerId}
          onChange={(e) => setFingerId(e.target.value)}
          placeholder="Finger slot (1-200)"
        />
        <button disabled={busy} onClick={() => runAction(() => wallet.writeContract.registerFinger(Number(fingerId)))}>
          Register
        </button>
      </div>

      <div className="card">
        <h2>Merchant Allowance</h2>
        <input
          value={merchantAddress}
          onChange={(e) => setMerchantAddress(e.target.value)}
          placeholder="Merchant address (0x...)"
        />
        <input value={allowanceAmount} onChange={(e) => setAllowanceAmount(e.target.value)} placeholder="Allowance in POL" />
        <button
          disabled={busy || !merchantAddress}
          onClick={() =>
            runAction(() => wallet.writeContract.setAllowance(merchantAddress, ethers.parseEther(allowanceAmount)))
          }
        >
          Set Allowance
        </button>
        <button
          className="danger"
          disabled={busy || !merchantAddress}
          onClick={() => runAction(() => wallet.writeContract.setAllowance(merchantAddress, 0n))}
        >
          Revoke
        </button>
      </div>

      <div className="card">
        <h2>Withdraw to Wallet</h2>
        <p>Bypasses every merchant and terminal — always available.</p>
        <input value={withdrawAmount} onChange={(e) => setWithdrawAmount(e.target.value)} placeholder="Amount in POL" />
        <button
          disabled={busy || !withdrawAmount}
          onClick={() => runAction(() => wallet.writeContract.withdrawToWallet(ethers.parseEther(withdrawAmount)))}
        >
          Withdraw
        </button>
      </div>

      {error && <p className="reason">{error}</p>}
    </div>
  );
}
