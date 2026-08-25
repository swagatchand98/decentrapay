# Environment setup

How to get every value in `contracts/.env.example`, `terminal/.env.example`, and
`web/.env.example`. Copy each `.env.example` to `.env` in the same folder and fill
it in — `.env` is gitignored, `.env.example` is not.

**Safety:** every private key here is an *operator* key (deployer, merchant,
terminal) — never a customer's. Per `CLAUDE.md`, a customer's private key must
never touch this repo in any form. Use fresh, disposable wallets funded only with
Amoy testnet POL. Never put a real wallet's key in any `.env` file.

## Before you start: one RPC URL, three wallets

Everything below reduces to getting one RPC endpoint and generating three
throwaway wallets. Do this first, then the per-variable sections just tell you
where each value goes.

### 1. An Amoy RPC URL

Used by `AMOY_RPC` (contracts, terminal) and `VITE_AMOY_RPC` (web) — same value in
all three places. Two options:

- **Public RPC, zero signup:** `https://rpc-amoy.polygon.technology` (from
  `docs/SPEC.md`'s Quick Reference). Fine for development; can be rate-limited or
  flaky under load.
- **A free provider account** (more reliable): sign up at
  [Alchemy](https://www.alchemy.com/) or [Infura](https://www.infura.io/), create
  an app, select network **Polygon Amoy**, and copy the HTTPS RPC URL it gives you.

### 2. Three wallets: deployer, merchant, terminal

You need three separate address/private-key pairs. (A fourth, the *customer*
wallet, is created by whoever's testing the checkout flow — it never goes in any
`.env` file here.)

Generate each one either way:

- **MetaMask (easiest):** open MetaMask → account menu → "Add account" → "Add a
  new account" (repeat 3x for three accounts). For each: click the account →
  "Account details" → "Show private key" for the key, and copy the address from
  the top of the account view.
- **Command line** (from `contracts/`, where `ethers` is already installed via
  Hardhat):
  ```bash
  node -e "const w = require('ethers').Wallet.createRandom(); console.log('address:', w.address); console.log('privateKey:', w.privateKey);"
  ```
  Run it three times, once per wallet, and save each address/key pair somewhere
  safe (a password manager, not a repo file).

Label them clearly as you go — **deployer**, **merchant**, **terminal** — you'll
place each one's address and/or key into specific variables below.

### 3. Fund the deployer and terminal wallets

Get free test POL from the [Polygon faucet](https://faucet.polygon.technology/):
select network **Polygon Amoy**, paste the address, request funds. Fund:

- The **deployer** wallet — pays gas to deploy the contract and call `setMerchant`.
- The **terminal** wallet — pays gas for every `charge()` call it signs later.
- The **merchant** wallet — only if you're setting `MERCHANT_KEY` (see below); it
  pays gas for one `registerTerminal` call.

## `contracts/.env`

| Variable | Value |
|---|---|
| `AMOY_RPC` | The RPC URL from step 1 above. |
| `DEPLOYER_KEY` | The **deployer** wallet's private key from step 2. Must be funded (step 3). |
| `MERCHANT_ADDRESS` | The **merchant** wallet's address from step 2. |
| `MERCHANT_KEY` | Optional. The **merchant** wallet's private key, only if you want `scripts/deploy.js` to auto-register the terminal for you. Leave blank to do that one step manually instead — the script will print the exact instructions when you run it. |
| `TERMINAL_ADDRESS` | The **terminal** wallet's address from step 2. Must match `terminal/.env`'s `TERMINAL_KEY` below — same wallet, referenced from both sides. |
| `POLYGONSCAN_API_KEY` | Free at [polygonscan.com/myapikey](https://polygonscan.com/myapikey) — sign up, then "Add" a new API key. Only needed to run `scripts/verify.js`. |

## `terminal/.env`

| Variable | Value |
|---|---|
| `AMOY_RPC` | Same RPC URL as above. |
| `TERMINAL_KEY` | The **terminal** wallet's private key from step 2. Must be funded (step 3), and its address must match `contracts/.env`'s `TERMINAL_ADDRESS`. |
| `SERIAL_PORT` | The OS device path for the ESP32, once it's plugged in. Find it with: `ls /dev/tty.usb*` (macOS), `ls /dev/ttyUSB*` or `/dev/ttyACM*` (Linux), or Device Manager → Ports (Windows, e.g. `COM3`). |
| `WS_PORT` | Not fetched from anywhere — pick any free local port for the terminal's own WebSocket server, e.g. `8080`. |

## `web/.env`

| Variable | Value |
|---|---|
| `VITE_AMOY_RPC` | Same RPC URL as above. |
| `VITE_CONTRACT_ADDRESS` | The deployed contract address. Not known until after you run `npm run deploy:amoy` in `contracts/` — it's printed in that script's summary, and also saved as `"address"` in the generated `shared/DecentraPay.json`. |

## Suggested order

1. Get the RPC URL and the three wallets (above); fund deployer + terminal.
2. Fill in `contracts/.env` completely.
3. Fill in `terminal/.env` completely.
4. From `contracts/`: `npm run deploy:amoy`.
5. Copy the printed contract address into `web/.env`'s `VITE_CONTRACT_ADDRESS`.
6. If you left `MERCHANT_KEY` blank, follow the manual `registerTerminal` step the
   deploy script printed.
7. Optional: `npm run verify:amoy` once `POLYGONSCAN_API_KEY` is set.
