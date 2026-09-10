require("@nomicfoundation/hardhat-toolbox");
require("dotenv").config();

/** @type import('hardhat/config').HardhatUserConfig */
module.exports = {
  solidity: "0.8.20",
  networks: {
    amoy: {
      url: process.env.AMOY_RPC || "",
      accounts: process.env.DEPLOYER_KEY ? [process.env.DEPLOYER_KEY] : [],
    },
  },
  etherscan: {
    // Etherscan's V2 API is unified across 60+ chains (Amoy included) under one
    // key — this must be a plain string, not a per-network object, to use it.
    // Polygon Amoy is already a built-in chain in hardhat-verify, so no
    // customChains entry is needed.
    apiKey: process.env.ETHERSCAN_API_KEY || "",
  },
};
