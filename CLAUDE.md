# DecentraPay

DecentraPay is a biometric crypto POS terminal built on Polygon Amoy (testnet). A
merchant-facing terminal device authenticates a customer via biometrics and settles
payment on-chain in real time.

## Components

- **contracts/** — Solidity smart contracts (Hardhat) implementing the on-chain
  payment/settlement logic, deployed to the Polygon Amoy testnet.
- **web/** — Merchant-facing dashboard (Vite + React + ethers v6) for managing
  terminals, viewing transactions, and configuring payouts.
- **terminal/** — Node.js service (ESM) running on the physical POS terminal. Talks
  to the biometric sensor over serial (`serialport`), streams state to attached
  displays/peripherals over WebSocket (`ws`), and submits settlement transactions
  on-chain via ethers v6.
- **firmware/** — Embedded firmware for the terminal's biometric sensor hardware.
  Empty for now.

## Tech choices

- Contracts: Solidity 0.8.20, Hardhat, targeting the Polygon Amoy testnet.
- Web: Vite, React, ethers v6.
- Terminal: Node.js, ESM modules, ethers v6, serialport, ws.
- Each workspace (`contracts/`, `web/`, `terminal/`) has its own independent
  `package.json`. No npm workspaces — this avoids hoisting issues with
  `serialport`'s native build.

## Spec

`docs/SPEC.md` is the authoritative spec for this project. Consult it before making
architectural decisions.
