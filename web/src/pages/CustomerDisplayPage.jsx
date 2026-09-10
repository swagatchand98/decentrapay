import { useTerminalSocket } from "../lib/useTerminalSocket.js";

const MESSAGES = {
  IDLE: () => ({ text: "DecentraPay" }),
  AWAITING_CUSTOMER: (s) => ({ text: `${s.amountPol} POL`, sub: "Place finger" }),
  IDENTIFYING: () => ({ text: "Identifying..." }),
  CONFIRM: (s) => ({ text: `Pay ${s.amountPol} POL?`, sub: `Balance ${s.balancePol} POL — GREEN = yes` }),
  SETTLING: () => ({ text: "Processing..." }),
  RECEIPT: (s) => ({ text: `PAID ${s.amountPol} POL`, sub: "Thank you" }),
};

// This view only ever receives broadcasts — it has no send() at all, matching
// how the real OLED has no back-channel either. It's a browser stand-in for
// the physical customer-facing screen, purely so the two-screen separation
// CLAUDE.md describes is visible while testing with no hardware attached.
export default function CustomerDisplayPage() {
  const { screen } = useTerminalSocket();
  const render = MESSAGES[screen.state] || MESSAGES.IDLE;
  const { text, sub } = render(screen);

  return (
    <div className="page">
      <div className="display-text">{text}</div>
      {sub && <div className="display-sub">{sub}</div>}
      {screen.state === "IDLE" && screen.reason && <div className="reason">{screen.reason}</div>}
    </div>
  );
}
