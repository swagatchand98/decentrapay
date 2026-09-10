#pragma once

// Fingerprint sensor <-> ESP32 (internal link)
#define FINGER_RX 16
#define FINGER_TX 17
#define FINGER_BAUD 57600

// ESP32 <-> terminal computer (USB link) — must match
// terminal/src/input/serialSource.js's BAUD_RATE
#define USB_BAUD 115200

// OLED (I2C)
#define OLED_SDA 21
#define OLED_SCL 22
#define OLED_ADDR 0x3C
#define OLED_WIDTH 128
#define OLED_HEIGHT 64

// Buttons + buzzer
#define BTN_CONFIRM 25
#define BTN_CANCEL 26
#define BUZZER 14
#define DEBOUNCE_MS 50
