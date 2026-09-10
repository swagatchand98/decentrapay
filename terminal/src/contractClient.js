import { createRequire } from "node:module";
import { ethers } from "ethers";
import { config } from "./config.js";

// Node's native JSON import assertion syntax varies across recent LTS versions;
// createRequire works identically everywhere Node 18+ runs.
const require = createRequire(import.meta.url);
const { address: CONTRACT_ADDRESS, abi: CONTRACT_ABI } = require("../../shared/DecentraPay.json");

const provider = new ethers.JsonRpcProvider(config.amoyRpc);
const wallet = new ethers.Wallet(config.terminalKey, provider);
const contract = new ethers.Contract(CONTRACT_ADDRESS, CONTRACT_ABI, wallet);

export const terminalAddress = wallet.address;

export async function terminalView(fingerId) {
  return contract.terminalView(fingerId, terminalAddress);
}

export async function charge(fingerId, amountWei) {
  return contract.charge(fingerId, amountWei);
}
