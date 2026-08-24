# DecentraPay

A biometric crypto POS terminal built on Polygon Amoy (testnet).

See [`CLAUDE.md`](./CLAUDE.md) for a project overview and [`docs/SPEC.md`](./docs/SPEC.md)
for the authoritative spec.

## Layout

- `contracts/` — Hardhat / Solidity smart contracts
- `web/` — merchant dashboard (Vite + React + ethers v6)
- `terminal/` — POS terminal service (Node.js ESM)
- `firmware/` — biometric sensor firmware (empty for now)

Each workspace is independent, with its own `package.json` — there are no npm
workspaces at the root. Copy each workspace's `.env.example` to `.env` and fill in
the values before running anything there.
