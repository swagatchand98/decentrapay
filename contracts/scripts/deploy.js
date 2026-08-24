// Usage: npx hardhat run scripts/deploy.js --network amoy   (or: npm run deploy:amoy)
require("dotenv").config();
const hre = require("hardhat");
const fs = require("fs");
const path = require("path");

const EXPLORER_BASE = "https://amoy.polygonscan.com";

async function main() {
  const { MERCHANT_ADDRESS, MERCHANT_KEY, TERMINAL_ADDRESS } = process.env;

  if (!MERCHANT_ADDRESS || !hre.ethers.isAddress(MERCHANT_ADDRESS)) {
    throw new Error(
      "MERCHANT_ADDRESS is missing or invalid in .env — see contracts/.env.example"
    );
  }
  if (!TERMINAL_ADDRESS || !hre.ethers.isAddress(TERMINAL_ADDRESS)) {
    throw new Error(
      "TERMINAL_ADDRESS is missing or invalid in .env — see contracts/.env.example"
    );
  }

  const [deployer] = await hre.ethers.getSigners();
  console.log(`Deploying DecentraPay with deployer ${deployer.address}...`);

  const DecentraPay = await hre.ethers.getContractFactory("DecentraPay");
  const decentraPay = await DecentraPay.deploy();
  await decentraPay.waitForDeployment();
  const address = await decentraPay.getAddress();
  console.log(`DecentraPay deployed to ${address}`);

  console.log(`Granting merchant status to ${MERCHANT_ADDRESS}...`);
  await (await decentraPay.setMerchant(MERCHANT_ADDRESS, true)).wait();

  let terminalRegistered = false;
  if (MERCHANT_KEY) {
    const merchantWallet = new hre.ethers.Wallet(MERCHANT_KEY, hre.ethers.provider);
    if (merchantWallet.address.toLowerCase() !== MERCHANT_ADDRESS.toLowerCase()) {
      throw new Error(
        `MERCHANT_KEY does not correspond to MERCHANT_ADDRESS (got ${merchantWallet.address}, ` +
          `expected ${MERCHANT_ADDRESS}). Fix .env before retrying.`
      );
    }
    console.log(`Registering terminal ${TERMINAL_ADDRESS} from the merchant account...`);
    await (
      await decentraPay.connect(merchantWallet).registerTerminal(TERMINAL_ADDRESS)
    ).wait();
    terminalRegistered = true;
  } else {
    console.log("\nMERCHANT_KEY not set in .env — registerTerminal() must be called");
    console.log("by the merchant's own wallet, and this script only holds the deployer's key.");
    console.log("Run this manually, signed by the merchant account:\n");
    console.log(`  contract : ${address}`);
    console.log(`  function : registerTerminal(address terminal)`);
    console.log(`  argument : ${TERMINAL_ADDRESS}`);
    console.log(`  from     : ${MERCHANT_ADDRESS}`);
    console.log('\nEasiest path: PolygonScan\'s "Write Contract" tab for the address above');
    console.log("(once verified — see scripts/verify.js), connected to the merchant's wallet.");
    console.log("Why manual: this keeps the merchant's private key out of this repo's .env");
    console.log("entirely unless you explicitly opt in by setting MERCHANT_KEY yourself.\n");
  }

  const artifact = await hre.artifacts.readArtifact("DecentraPay");
  const sharedDir = path.join(__dirname, "..", "..", "shared");
  fs.mkdirSync(sharedDir, { recursive: true });
  const sharedPath = path.join(sharedDir, "DecentraPay.json");
  fs.writeFileSync(sharedPath, JSON.stringify({ address, abi: artifact.abi }, null, 2) + "\n");
  console.log(`\nWrote address + ABI to ${path.relative(process.cwd(), sharedPath)}`);

  console.log("\n--- Deployment summary ---");
  console.log(`Contract address : ${address}`);
  console.log(`Explorer         : ${EXPLORER_BASE}/address/${address}`);
  console.log(`Merchant         : ${MERCHANT_ADDRESS}`);
  console.log(
    `Terminal         : ${TERMINAL_ADDRESS}${
      terminalRegistered ? "" : " (NOT yet registered — see instructions above)"
    }`
  );
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
