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

Used by `AMOY_RPC` (contracts, terminal) and `VITE_AMOY_RPC` (web) — same value inc  
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
select network **Polygon Amoy**, paste the address, request funds.

**Get more than you think you need.** Deploying `DecentraPay` alone has been
observed costing ~0.16 POL in gas on Amoy — one faucet drip (often ~0.1 POL) can
fall short, which fails with `ProviderError: insufficient funds for gas * price +
value` from Hardhat. Aim for at least **0.5 POL** on the deployer before running
`deploy:amoy`; if one request isn't enough, request again after any cooldown, or
use a second faucet (e.g. Alchemy's or a thirdweb Amoy faucet).

Fund:

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
| `ETHERSCAN_API_KEY` | Free at [etherscan.io/myapikey](https://etherscan.io/myapikey) — sign up (at Etherscan, not PolygonScan; their API keys are unified across 60+ chains including Amoy now), then "Add" a new API key. Only needed to run `scripts/verify.js`. |
| `CONTRACT_ADDRESS` | Optional, normally left blank. Only set this if `deploy:amoy` deployed successfully but then failed on a later step (a flaky RPC mid-script is the usual cause) — set it to the address that was printed, then re-run `deploy:amoy` to resume without paying to deploy again. |

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
| `VITE_CONTRACT_ADDRESS` | Optional. Leave blank — the app defaults to the address in `shared/DecentraPay.json` (written by `deploy:amoy`), which is the source of truth. Only set this to point the app at a different deployment without touching that file. |
| `VITE_TERMINAL_WS_URL` | Optional. Leave blank — defaults to `ws://localhost:8080`. Only set this if you changed `terminal/.env`'s `WS_PORT` away from 8080. |

## Suggested order

1. Get the RPC URL and the three wallets (above); fund deployer + terminal.
2. Fill in `contracts/.env` completely.
3. Fill in `terminal/.env` completely (leave `SERIAL_PORT` blank if you don't
   have the ESP32 wired up yet — see "Testing without hardware" below).
4. From `contracts/`: `npm run deploy:amoy`. This writes `shared/DecentraPay.json`,
   which `web/` and `terminal/` both read automatically — `web/.env` needs
   nothing further for the contract address.
5. If you left `MERCHANT_KEY` blank, follow the manual `registerTerminal` step the
   deploy script printed.
6. Optional: `npm run verify:amoy` once `ETHERSCAN_API_KEY` is set.

## Testing without hardware

`terminal/` doesn't require the ESP32 to be connected. Leave `SERIAL_PORT` blank
(or don't set it at all) and `npm start` in `terminal/` falls into a CLI mock
input mode instead of real serial — it prints a prompt, and typing lines into
that same terminal window drives the state machine exactly as a real scan or
button press would:

- `FINGER:<slot>` — simulate a finger scan for that slot
- `CONFIRM` — simulate the customer's green button
- `CANCEL` — simulate the customer's red button

To exercise the full flow: run `terminal/` (`npm start`), then `web/` (`npm run
dev`), and open three browser tabs — `/` (connect a funded customer wallet,
deposit, register a finger, set an allowance for your merchant address), `/pos`
(enter an amount, press Charge), and `/display` (a stand-in for the physical
OLED). Back in `terminal/`'s console, type the `FINGER:<slot>` you registered,
then `CONFIRM` — both browser tabs update live, and `/pos` ends on a receipt with
a QR to the transaction. `firmware/` implements the same protocol for when the
real ESP32 is wired up; nothing else changes.

## If `deploy:amoy` fails partway through

The Amoy RPC (especially the free public one) can drop a connection mid-script.
Check the output for how far it got:

- **Failed before "DecentraPay deployed to..."** — nothing happened on-chain, no
  gas spent. Just re-run `npm run deploy:amoy`.
- **Printed an address, then failed later** (e.g. during `setMerchant` or
  `registerTerminal`) — the contract is live and gas is already spent. Don't
  re-run it plain, or you'll deploy a second, wasted contract. Instead, set
  `CONTRACT_ADDRESS` in `.env` to the address it printed and re-run
  `npm run deploy:amoy` — it'll skip deployment and pick up from `setMerchant`.
