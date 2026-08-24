// Usage: npx hardhat run scripts/verify.js --network amoy   (or: npm run verify:amoy)
// Verifies whatever address is in ../shared/DecentraPay.json, unless CONTRACT_ADDRESS
// is set in .env to override it.
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
  console.log(`Verifying DecentraPay at ${address} on Amoy...`);

  await hre.run("verify:verify", {
    address,
    constructorArguments: [],
  });
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
