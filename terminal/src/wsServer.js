import { WebSocketServer } from "ws";

// getStateMachine is a lazy getter rather than a direct reference to break the
// circular init dependency: the state machine needs broadcast() to exist before
// it's constructed, and this server needs the state machine to exist before it
// can route messages. By the time any handler below actually fires (a client
// connecting or sending a message), index.js has finished wiring both up.
export function createWsServer({ port, getStateMachine }) {
  const wss = new WebSocketServer({ port });

  wss.on("connection", (ws) => {
    ws.send(JSON.stringify(getStateMachine().getSnapshot()));

    ws.on("message", (data) => {
      let msg;
      try {
        msg = JSON.parse(data.toString());
      } catch {
        return;
      }

      const stateMachine = getStateMachine();
      if (msg.type === "START_CHARGE") stateMachine.startCharge(msg.amountPol);
      else if (msg.type === "CANCEL") stateMachine.cancel();
    });
  });

  function broadcast(message) {
    const payload = JSON.stringify(message);
    for (const client of wss.clients) {
      if (client.readyState === client.OPEN) client.send(payload);
    }
  }

  console.log(`WebSocket server listening on ws://localhost:${port}`);

  return { broadcast, close: () => wss.close() };
}
