import "dotenv/config";

function required(name) {
  const value = process.env[name];
  if (!value) {
    throw new Error(`${name} is not set in .env — see terminal/.env.example`);
  }
  return value;
}

export const config = {
  amoyRpc: required("AMOY_RPC"),
  terminalKey: required("TERMINAL_KEY"),
  serialPort: process.env.SERIAL_PORT || "",
  wsPort: Number(process.env.WS_PORT) || 8080,
};
