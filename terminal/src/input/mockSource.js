import readline from "node:readline";

// Passes typed lines straight through, unmodified — a human typing "FINGER:7"
// is the same protocol string real firmware would send, so the state machine
// that consumes onLine() never needs to know which source it's getting lines
// from.
export function createMockSource({ onLine }) {
  console.log("SERIAL_PORT not set — using CLI mock input.");
  console.log("Type FINGER:<slot> to simulate a scan, or CONFIRM / CANCEL to simulate a button press.\n");

  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  rl.on("line", (line) => {
    const trimmed = line.trim();
    if (trimmed) onLine(trimmed);
  });

  return {
    mode: "mock",
    write(cmd) {
      console.log(`[terminal -> firmware] ${cmd}`);
    },
    close() {
      rl.close();
    },
  };
}
