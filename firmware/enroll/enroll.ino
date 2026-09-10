// Adapted from the Adafruit_Fingerprint library's stock "enroll" example,
// wired to this project's pins. Run this once per new customer to assign a
// fingerprint slot, then have them call registerFinger(slot) from the
// onboarding page (web/, at "/") to bind that slot to their wallet on-chain.
// No biometric data ever leaves this sketch — only the slot number.
#include <Adafruit_Fingerprint.h>
#include "../decentrapay_terminal/config.h"

HardwareSerial fingerSerial(2);
Adafruit_Fingerprint finger(&fingerSerial);

uint8_t enrollId;

void setup() {
  Serial.begin(USB_BAUD);
  while (!Serial);
  delay(100);
  Serial.println("\n\nDecentraPay finger enrollment");

  fingerSerial.begin(FINGER_BAUD, SERIAL_8N1, FINGER_RX, FINGER_TX);
  finger.begin(FINGER_BAUD);

  if (finger.verifyPassword()) {
    Serial.println("Fingerprint sensor found.");
  } else {
    Serial.println("Fingerprint sensor not found. Check wiring.");
    while (1) delay(1);
  }
}

uint8_t readNumber() {
  uint8_t num = 0;
  while (num == 0) {
    while (!Serial.available());
    num = Serial.parseInt();
  }
  return num;
}

void loop() {
  Serial.println("\nEnter the slot ID to enroll (1-200):");
  enrollId = readNumber();
  if (enrollId == 0) return;

  Serial.printf("Enrolling slot #%d\n", enrollId);
  while (!getFingerprintEnroll());
}

uint8_t getFingerprintEnroll() {
  int p = -1;
  Serial.println("Place finger on sensor...");
  while (p != FINGERPRINT_OK) {
    p = finger.getImage();
    switch (p) {
      case FINGERPRINT_OK:
        Serial.println("Image taken");
        break;
      case FINGERPRINT_NOFINGER:
        break;
      default:
        Serial.println("Sensor error");
        return p;
    }
  }

  p = finger.image2Tz(1);
  if (p != FINGERPRINT_OK) return p;

  Serial.println("Remove finger.");
  delay(2000);
  p = 0;
  while (p != FINGERPRINT_NOFINGER) p = finger.getImage();

  Serial.println("Place the same finger again...");
  p = -1;
  while (p != FINGERPRINT_OK) {
    p = finger.getImage();
    if (p != FINGERPRINT_OK && p != FINGERPRINT_NOFINGER) return p;
  }

  p = finger.image2Tz(2);
  if (p != FINGERPRINT_OK) return p;

  p = finger.createModel();
  if (p != FINGERPRINT_OK) {
    Serial.println("Prints did not match — try again.");
    return p;
  }

  p = finger.storeModel(enrollId);
  if (p == FINGERPRINT_OK) {
    Serial.printf(
      "Stored as slot #%d. Have the customer call registerFinger(%d) from their wallet.\n",
      enrollId, enrollId
    );
  } else {
    Serial.println("Failed to store model.");
  }
  return p;
}
