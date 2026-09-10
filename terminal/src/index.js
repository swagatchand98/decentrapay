import { config } from "./config.js";
import { terminalAddress } from "./contractClient.js";
import { StateMachine } from "./stateMachine.js";
import { createWsServer } from "./wsServer.js";
import { createInputSource } from "./input/index.js";

async function main() {
  let stateMachine;

  const wsServer = createWsServer({
    port: config.wsPort,
    getStateMachine: () => stateMachine,
  });

  const input = await createInputSource({
    serialPort: config.serialPort,
    onLine: (line) => stateMachine.handleLine(line),
  });

  stateMachine = new StateMachine({ input, broadcast: wsServer.broadcast });

  console.log("\n--- DecentraPay terminal ---");
  console.log(`Terminal address : ${terminalAddress}`);
  console.log(`Input mode       : ${input.mode}`);
  console.log(`WebSocket        : ws://localhost:${config.wsPort}`);
  console.log("----------------------------\n");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
