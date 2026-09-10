#include <Wire.h>
#include <Adafruit_GFX.h>
#include <Adafruit_SSD1306.h>
#include <Adafruit_Fingerprint.h>
#include "config.h"

HardwareSerial fingerSerial(2);
Adafruit_Fingerprint finger(&fingerSerial);
Adafruit_SSD1306 display(OLED_WIDTH, OLED_HEIGHT, &Wire, -1);

enum State { IDLE, WAIT_FINGER, ASKING, SETTLING, DONE };
State state = IDLE;

unsigned long lastConfirmPress = 0;
unsigned long lastCancelPress = 0;

void setup() {
  Serial.begin(USB_BAUD);
  fingerSerial.begin(FINGER_BAUD, SERIAL_8N1, FINGER_RX, FINGER_TX);
  finger.begin(FINGER_BAUD);

  Wire.begin(OLED_SDA, OLED_SCL);
  display.begin(SSD1306_SWITCHCAPVCC, OLED_ADDR);

  pinMode(BTN_CONFIRM, INPUT_PULLUP);
  pinMode(BTN_CANCEL, INPUT_PULLUP);
  pinMode(BUZZER, OUTPUT);

  oled("DecentraPay");
}

void loop() {
  if (Serial.available()) {
    String cmd = Serial.readStringUntil('\n');
    cmd.trim();
    handleCommand(cmd);
  }

  if (state == WAIT_FINGER) {
    int id = getFingerprintID();
    if (id > 0) {
      beep(1);
      Serial.printf("FINGER:%d\n", id);
      oled("Identifying...");
    }
  }

  if (state == ASKING) {
    if (pressedDebounced(BTN_CONFIRM, lastConfirmPress)) {
      Serial.println("CONFIRM");
    }
    if (pressedDebounced(BTN_CANCEL, lastCancelPress)) {
      Serial.println("CANCEL");
      beep(2);
    }
  }

  delay(50);
}

void handleCommand(const String &cmd) {
  if (cmd.startsWith("ASK:")) {
    showAsk(cmd);
    state = ASKING;
  } else if (cmd.startsWith("PAID:")) {
    showPaid(cmd);
    beep(1);
    state = DONE;
  } else if (cmd.startsWith("CHARGE:")) {
    showAmount(cmd);
    state = WAIT_FINGER;
  } else if (cmd.startsWith("REJECT:")) {
    showError(cmd);
    beep(2);
    state = IDLE;
  } else if (cmd == "WAIT") {
    oled("Processing...");
    // SPEC's original reference loop never leaves ASKING on this branch,
    // which lets a lingering button press double-fire CONFIRM/CANCEL during
    // settlement. Moving to a dedicated SETTLING state fixes that; the wire
    // protocol to terminal/ is unchanged.
    state = SETTLING;
  } else if (cmd == "IDLE") {
    oled("DecentraPay");
    state = IDLE;
  }
}

// -- OLED helpers --------------------------------------------------------

void oled(const String &line1, const String &line2) {
  display.clearDisplay();
  display.setTextSize(2);
  display.setTextColor(SSD1306_WHITE);
  display.setCursor(0, 0);
  display.println(line1);
  if (line2.length() > 0) {
    display.setTextSize(1);
    display.println(line2);
  }
  display.display();
}

void oled(const String &line1) {
  oled(line1, "");
}

void showAmount(const String &cmd) {
  // "CHARGE:<amountPol>"
  String amount = cmd.substring(String("CHARGE:").length());
  oled(amount + " POL", "Place finger");
}

void showAsk(const String &cmd) {
  // "ASK:<amountPol>:<balancePol>"
  int firstColon = cmd.indexOf(':');
  int secondColon = cmd.indexOf(':', firstColon + 1);
  String amount = cmd.substring(firstColon + 1, secondColon);
  String balance = cmd.substring(secondColon + 1);
  oled("Pay " + amount + " POL?", "Bal " + balance + " - GREEN=yes");
}

void showPaid(const String &cmd) {
  // "PAID:<amountPol>"
  String amount = cmd.substring(String("PAID:").length());
  oled("PAID " + amount + " POL", "Thank you");
}

void showError(const String &cmd) {
  // "REJECT:<reason>"
  String reason = cmd.substring(String("REJECT:").length());
  oled("Declined", reason);
}

// -- Sensor / buttons / buzzer -------------------------------------------

int getFingerprintID() {
  if (finger.getImage() != FINGERPRINT_OK) return -1;
  if (finger.image2Tz() != FINGERPRINT_OK) return -1;
  if (finger.fingerFastSearch() != FINGERPRINT_OK) return -1;
  return finger.fingerID;
}

bool pressedDebounced(int pin, unsigned long &lastPressRef) {
  if (digitalRead(pin) != LOW) return false; // INPUT_PULLUP: LOW = pressed
  unsigned long now = millis();
  if (now - lastPressRef < DEBOUNCE_MS) return false;
  lastPressRef = now;
  return true;
}

void beep(int times) {
  for (int i = 0; i < times; i++) {
    digitalWrite(BUZZER, HIGH);
    delay(80);
    digitalWrite(BUZZER, LOW);
    delay(80);
  }
}
