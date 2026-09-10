// Usage: npx hardhat run scripts/status.js --network amoy   (or: npm run status:amoy)
// Read-only — costs no gas. Reports what's already true on-chain for the
// contract in ../shared/DecentraPay.json (or CONTRACT_ADDRESS from .env), so you
// can tell what a partially-failed deploy:amoy run actually completed before
// spending any more test POL retrying it.
require("dotenv").config();
const hre = require("hardhat");
const fs = require("fs");
const path = require("path");

function resolveAddress() {
  if (process.env.CONTRACT_ADDRESS) return process.env.CONTRACT_ADDRESS;

  const sharedPath = path.join(__dirname, "..", "..", "shared", "DecentraPay.json");
  if (fs.existsSync(sharedPath)) {
    const { address } = JSON.parse(fs.readFileSync(sharedPath, "utf8"));
    if (address) return address;
  }

  throw new Error(
    "No contract address found. Set CONTRACT_ADDRESS in .env, or run scripts/deploy.js " +
      "first so ../shared/DecentraPay.json exists."
  );
}

async function main() {
  const address = resolveAddress();
  const { MERCHANT_ADDRESS, TERMINAL_ADDRESS } = process.env;

  const decentraPay = await hre.ethers.getContractAt("DecentraPay", address);
  console.log(`Contract: ${address}\n`);

  if (MERCHANT_ADDRESS) {
    const flagged = await decentraPay.isMerchant(MERCHANT_ADDRESS);
    console.log(`setMerchant(${MERCHANT_ADDRESS}, true)  -> ${flagged ? "DONE" : "not done"}`);
  } else {
    console.log("MERCHANT_ADDRESS not set in .env — skipping that check.");
  }

  if (TERMINAL_ADDRESS) {
    const owner = await decentraPay.terminalOwner(TERMINAL_ADDRESS);
    const registered = owner !== hre.ethers.ZeroAddress;
    console.log(
      `registerTerminal(${TERMINAL_ADDRESS}) -> ${
        registered ? `DONE (merchant ${owner})` : "not done"
      }`
    );
  } else {
    console.log("TERMINAL_ADDRESS not set in .env — skipping that check.");
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
