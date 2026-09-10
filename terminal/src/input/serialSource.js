import { SerialPort } from "serialport";
import { ReadlineParser } from "@serialport/parser-readline";

// Must match firmware/decentrapay_terminal/config.h's USB_BAUD.
const BAUD_RATE = 115200;
const RECONNECT_DELAY_MS = 2000;

export function createSerialSource({ path, onLine }) {
  // `state.port` is always the current live port — write()/close() below read
  // through it rather than closing over a specific port object, so a
  // reconnect can swap it out without leaving those callbacks pointing at a
  // stale, closed port.
  const state = { port: null };

  function openOnce(isReconnect) {
    return new Promise((resolve) => {
      const port = new SerialPort({ path, baudRate: BAUD_RATE, autoOpen: false });

      port.open((err) => {
        if (err) {
          if (isReconnect) {
            console.error(
              `[serial] reconnect to ${path} failed (${err.message}), retrying in ${RECONNECT_DELAY_MS}ms...`
            );
            setTimeout(() => openOnce(true), RECONNECT_DELAY_MS);
          }
          resolve({ opened: false, error: err.message });
          return;
        }

        state.port = port;

        const parser = port.pipe(new ReadlineParser({ delimiter: "\n" }));
        parser.on("data", (line) => {
          const trimmed = line.trim();
          if (trimmed) onLine(trimmed);
        });

        port.on("close", () => {
          console.warn(`[serial] ${path} disconnected — retrying in ${RECONNECT_DELAY_MS}ms...`);
          setTimeout(() => openOnce(true), RECONNECT_DELAY_MS);
        });
        port.on("error", (e) => console.error(`[serial] error on ${path}:`, e.message));

        resolve({ opened: true });
      });
    });
  }

  return openOnce(false).then((result) => {
    if (!result.opened) return result;
    return {
      opened: true,
      mode: "serial",
      write(cmd) {
        if (state.port?.writable) state.port.write(`${cmd}\n`);
      },
      close() {
        state.port?.close();
      },
    };
  });
}
