import { useState } from "react";
import { useTerminalSocket } from "../lib/useTerminalSocket.js";

export default function PosPage() {
  const { screen, connected, send } = useTerminalSocket();
  const [amount, setAmount] = useState("0.01");

  function charge() {
    if (!amount || Number(amount) <= 0) return;
    send({ type: "START_CHARGE", amountPol: amount });
  }

  function cancel() {
    send({ type: "CANCEL" });
  }

  return (
    <div className="page">
      <h1>DecentraPay — Merchant</h1>
      {!connected && <p className="reason">Not connected to terminal service.</p>}

      {screen.state === "IDLE" && (
        <div className="card">
          <div className="keypad">{amount} POL</div>
          <input type="number" step="0.001" min="0" value={amount} onChange={(e) => setAmount(e.target.value)} />
          <button onClick={charge}>Charge</button>
          {screen.reason && <p className="reason">Last attempt rejected: {screen.reason}</p>}
        </div>
      )}

      {screen.state === "AWAITING_CUSTOMER" && (
        <div className="card">
          <h2>Waiting for customer…</h2>
          <p>{screen.amountPol} POL — ask them to place a finger.</p>
          <button className="secondary" onClick={cancel}>
            Cancel
          </button>
        </div>
      )}

      {screen.state === "IDENTIFYING" && (
        <div className="card">
          <h2>Identifying…</h2>
          <p>Finger slot {screen.fingerId}</p>
        </div>
      )}

      {screen.state === "CONFIRM" && (
        <div className="card">
          <h2>Awaiting customer confirmation</h2>
          <div className="stat">
            <span>Customer</span>
            <span>
              {screen.customer?.slice(0, 6)}...{screen.customer?.slice(-4)}
            </span>
          </div>
          <div className="stat">
            <span>Balance</span>
            <span>{screen.balancePol} POL</span>
          </div>
          <div className="stat">
            <span>Amount</span>
            <span>{screen.amountPol} POL</span>
          </div>
          <p>Customer confirms on their own screen — not here.</p>
          <button className="secondary" onClick={cancel}>
            Cancel
          </button>
        </div>
      )}

      {screen.state === "SETTLING" && (
        <div className="card">
          <h2>Settling…</h2>
          <p>{screen.amountPol} POL</p>
        </div>
      )}

      {screen.state === "RECEIPT" && (
        <div className="card">
          <h2>PAID {screen.amountPol} POL</h2>
          <p>Block {screen.blockNumber}</p>
          {screen.qrDataUrl && (
            <div className="qr">
              <img src={screen.qrDataUrl} alt="Transaction QR" width={160} height={160} />
            </div>
          )}
          <p>
            <a href={screen.explorerUrl} target="_blank" rel="noreferrer">
              View on explorer
            </a>
          </p>
        </div>
      )}
    </div>
  );
}
