import { createSerialSource } from "./serialSource.js";
import { createMockSource } from "./mockSource.js";

export async function createInputSource({ serialPort, onLine }) {
  if (serialPort) {
    const real = await createSerialSource({ path: serialPort, onLine });
    if (real.opened) {
      console.log(`Using real serial input on ${serialPort}.`);
      return real;
    }
    console.warn(`Could not open ${serialPort} (${real.error}) — falling back to CLI mock input.`);
  }

  return createMockSource({ onLine });
}
