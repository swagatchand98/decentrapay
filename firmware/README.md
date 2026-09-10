# DecentraPay firmware

ESP32 sketches for the terminal's peripheral controller — no networking, no
crypto, no chain access. See `docs/SPEC.md` sections 5 and 10 for the full
hardware rationale.

## Wiring

| ESP32 | To | Note |
|---|---|---|
| GPIO 16 (RX2) | Sensor **TX** | Crossed. Always. |
| GPIO 17 (TX2) | Sensor **RX** | |
| 3V3 | Sensor VCC | Check your module — some want 5V power, 3.3V logic |
| GPIO 21 / 22 | OLED SDA / SCL | Address usually 0x3C |
| GPIO 25 | Confirm button | `INPUT_PULLUP`, other leg to GND |
| GPIO 26 | Cancel button | `INPUT_PULLUP` |
| GPIO 14 | Buzzer | |
| GND | Everything | Common ground |

## Libraries (Arduino Library Manager)

- `Adafruit Fingerprint Sensor Library`
- `Adafruit SSD1306`
- `Adafruit GFX Library`
- ESP32 board package (Boards Manager: `esp32` by Espressif Systems)

## Flashing order

1. Wire everything per the table above.
2. Flash `enroll/enroll.ino` first. Open the Serial Monitor at 115200 baud,
   enroll a test finger into slot 1, confirm it reports success.
3. Flash `decentrapay_terminal/decentrapay_terminal.ino`. This is what
   actually talks to `terminal/`'s Node service over USB serial at 115200 baud
   — set `terminal/.env`'s `SERIAL_PORT` to whatever device path it enumerates
   as (see `docs/ENV_SETUP.md`).
4. On the customer's own device, call `registerFinger(<slot>)` from the
   onboarding page (`web/`, at `/`) to bind that slot to their wallet on-chain.

## Serial protocol (to/from `terminal/`)

| Direction | Line | Meaning |
|---|---|---|
| ESP32 → terminal | `FINGER:<slot>` | A finger matching `<slot>` was scanned |
| ESP32 → terminal | `CONFIRM` | Customer pressed the green button |
| ESP32 → terminal | `CANCEL` | Customer pressed the red button |
| terminal → ESP32 | `CHARGE:<amountPol>` | A charge session started; show the amount, wait for a finger |
| terminal → ESP32 | `ASK:<amountPol>:<balancePol>` | Show the confirm screen |
| terminal → ESP32 | `WAIT` | Show "Processing..." |
| terminal → ESP32 | `PAID:<amountPol>` | Show the receipt, one buzz |
| terminal → ESP32 | `REJECT:<reason>` | Show the rejection reason, two buzzes |
| terminal → ESP32 | `IDLE` | Back to the idle screen |

## Known gotchas (from docs/SPEC.md)

- `HardwareSerial(2)` at 57600 baud for the sensor — not `SoftwareSerial`, it's
  unreliable on ESP32 at this rate.
- Enroll two fingers per person; index fingers get dry, cold, or dirty.
- Test under actual demo lighting — optical sensors dislike direct sunlight.
- Debounce buttons (50ms here) or one press reads as several.
