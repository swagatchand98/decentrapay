# DecentraPay

DecentraPay is a biometric crypto point-of-sale terminal for Polygon Amoy (testnet).
A merchant enters an amount; a customer identifies themselves with a fingerprint —
not a card, phone, PIN, or bank account; funds move on-chain from the customer's
vault to the merchant's in about two seconds. Two very different users: the
**merchant**, who owns a terminal and wants card-free settlement without MDR fees,
and the **customer**, whose money lives entirely in a smart contract they alone
control — never in a bank, and never in the terminal.

`docs/SPEC.md` is the authoritative spec. Read it before any architectural
decision — this file is oriented context, not a substitute.

## Security model

Something has to sign to move money, and the customer brings no device, so the
terminal signs. The whole design is about bounding that authority.

- The customer's private key **never touches the terminal**, in any form, at any
  point. It never leaves the customer's own device.
- The terminal holds its own hot key, but its authority is bounded **on-chain**:
  `charge()` can only spend against the allowance the customer explicitly granted
  that merchant with `setAllowance()`.
- Two independent on-chain ceilings apply on top of the allowance, enforced in the
  contract, not the terminal: a per-transaction cap (`MAX_PER_TX`) and a daily cap
  (`DAILY_LIMIT`).
- The customer can revoke a merchant's allowance instantly, from their own wallet,
  at any time: `setAllowance(merchant, 0)`.
- The customer always has a bypass: `withdrawToWallet()` sends funds straight to
  their own wallet, around every merchant and terminal. Without it, this would be
  custody with extra steps.

## Components and data flow

| Component | Role |
|---|---|
| `contracts/` | `DecentraPay.sol` on Polygon Amoy — source of truth for identity, balances, allowances, and payments. Every other component talks to it over RPC. |
| `firmware/` | ESP32 peripheral controller. Scans fingers, drives the customer-facing OLED/buttons/buzzer. Talks only to `terminal/`, over serial — no networking, no chain access. |
| `terminal/` | Node.js signer service on the terminal's computer. Reads finger-slot events from `firmware/` over serial, calls the contract (`terminalView`, `charge`) via ethers v6, and pushes screen state to `web/`'s POS view over a local WebSocket. |
| `web/` | React/Vite UI, two separate audiences: the **merchant POS screen**, run in Chromium kiosk mode on the terminal machine and driven by state from `terminal/`; and the **customer onboarding page**, opened on the customer's own device, which calls the contract directly (`deposit`, `registerFinger`, `setAllowance`) — `terminal/` is never involved in onboarding. |

Each workspace has its own independent `package.json` — no npm workspaces, to avoid
hoisting issues with `serialport`'s native build.

## Transaction flow: amount to receipt

1. **IDLE** — merchant screen shows an amount keypad; customer OLED shows "DecentraPay".
2. Merchant enters an amount, presses CHARGE → **AWAITING CUSTOMER**; OLED shows "\<amount\> — Place finger".
3. Customer scans a finger. Firmware sends `FINGER:<slot>` over serial; terminal calls `terminalView(fingerId, terminalAddress)`.
   - Unknown finger, insufficient balance, over allowance, or over daily limit → reject: OLED shows the reason, buzzer sounds, back to IDLE.
4. All checks pass → **CONFIRM** — merchant screen shows the customer's address and balance; OLED shows "Pay \<amount\>? Balance \<bal\>. GREEN = yes".
5. Customer presses the physical **GREEN** button on their own side of the device — never the merchant's screen. Firmware sends `CONFIRM`.
6. **SETTLING** — terminal calls `charge(fingerId, amount)`, signs, and broadcasts. Both screens show "Processing…".
7. Transaction confirms → **RECEIPT** — merchant screen shows the amount, block number, and a QR code to the tx on a public block explorer; OLED shows "PAID — Thank you" with one buzz.
8. After a 6-second timeout, back to IDLE.

## Naming conventions

- **customer** — an address holding funds in the vault (`balanceOf`), owns its own allowances. Never signs anything from terminal hardware.
- **merchant** — an address flagged `isMerchant`; owns one or more terminals and receives payments into `merchantBalance`.
- **terminal** — an address (the terminal's own hot wallet), registered to exactly one merchant via `registerTerminal`. Signs `charge()` calls; never holds customer funds.
- **fingerId** — a `uint16` slot (1–200) assigned by the sensor at enrollment and bound on-chain to one customer (`registerFinger` / `ownerOfFinger`). Identifies a customer to the contract — it is not an address, and carries no biometric data.

## Never do this

- Never ask a customer for a seed phrase or private key — not on a screen, not on paper, not "just for testing." Every scam terminal works this way.
- Never store biometric data anywhere. The sensor returns only a `fingerId` slot; no fingerprint image or template leaves the sensor's own flash.
- Never put a private key in code, a commit, or a tracked config file. `TERMINAL_KEY` / `DEPLOYER_KEY` live only in a gitignored `.env` — see each workspace's `.env.example`.
