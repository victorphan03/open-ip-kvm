#include <Keyboard.h>
#include <Mouse.h>

#define KB_EVT_START 248
#define MOUSE_EVT_START 249
#define KEY_SEQUENCE_EVT_START 250
#define POWER_EVT_START 252
#define EVT_END 251

#define KB_EVT_TYPE_KEYDOWN 1
#define KB_EVT_TYPE_KEYUP 2
#define KB_EVT_TYPE_RESET 3

#define MOUSE_EVT_TYPE_MOVE 1
#define MOUSE_EVT_TYPE_LEFT_DOWN 2
#define MOUSE_EVT_TYPE_LEFT_UP 3
#define MOUSE_EVT_TYPE_MIDDLE_DOWN 4
#define MOUSE_EVT_TYPE_MIDDLE_UP 5
#define MOUSE_EVT_TYPE_RIGHT_DOWN 6
#define MOUSE_EVT_TYPE_RIGHT_UP 7
#define MOUSE_EVT_TYPE_WHEEL 8
#define MOUSE_EVT_TYPE_RESET 9
#define MOUSE_EVT_TYPE_CONFIG_MOVE_FACTOR 10

#define POWER_EVT_TYPE_PRESS 1   // Short press (toggle power)

#define R_BUF_LEN 32
#define POWER_BTN_PIN 4  // Pin 4 for power button (opto-isolator)

bool led = false;

int rBuf[R_BUF_LEN];
int rBufCursor = 0;
int mouseMoveFactor = 1;

void blink() {
  digitalWrite(LED_BUILTIN, led ? HIGH : LOW);
  led = !led;
}
void setup() {
  pinMode(LED_BUILTIN, OUTPUT);
  digitalWrite(LED_BUILTIN, LOW);
  
  // Power button pin
  pinMode(POWER_BTN_PIN, OUTPUT);
  digitalWrite(POWER_BTN_PIN, LOW);

  Keyboard.begin();
  Mouse.begin();

  Serial1.begin(115200);
}

void parse_r_buf() {
  if (rBuf[0] == KB_EVT_START && rBufCursor == 3) {
    switch (rBuf[1]) {
       case KB_EVT_TYPE_KEYDOWN:
        Keyboard.press(rBuf[2]);
        break;
       case KB_EVT_TYPE_KEYUP:
        Keyboard.release(rBuf[2]);
        break;
       case KB_EVT_TYPE_RESET:
        Keyboard.releaseAll();
        break;
    }
  }

  if (rBuf[0] == MOUSE_EVT_START && rBufCursor == 4) {
    switch (rBuf[1]) {
       case MOUSE_EVT_TYPE_MOVE:
        Mouse.move(mouseMoveFactor * (rBuf[2] - 120), mouseMoveFactor * (rBuf[3] - 120), 0);
        break;
       case MOUSE_EVT_TYPE_LEFT_DOWN:
        Mouse.press(MOUSE_LEFT);
        break;
       case MOUSE_EVT_TYPE_LEFT_UP:
        Mouse.release(MOUSE_LEFT);
        break;
       case MOUSE_EVT_TYPE_RIGHT_DOWN:
        Mouse.press(MOUSE_RIGHT);
        break;
       case MOUSE_EVT_TYPE_RIGHT_UP:
        Mouse.release(MOUSE_RIGHT);
        break;
       case MOUSE_EVT_TYPE_MIDDLE_DOWN:
        Mouse.press(MOUSE_MIDDLE);
        break;
       case MOUSE_EVT_TYPE_MIDDLE_UP:
        Mouse.release(MOUSE_MIDDLE);
        break;
       case MOUSE_EVT_TYPE_WHEEL:
        Mouse.move(0, 0, rBuf[2] - 120);
        break;
       case MOUSE_EVT_TYPE_RESET:
        Mouse.release(MOUSE_LEFT);
        Mouse.release(MOUSE_RIGHT);
        Mouse.release(MOUSE_MIDDLE);
        break;
       case MOUSE_EVT_TYPE_CONFIG_MOVE_FACTOR:
        mouseMoveFactor = rBuf[2];
    }
  }

  if (rBuf[0] == KEY_SEQUENCE_EVT_START && rBufCursor > 1) {
      Keyboard.releaseAll();
      for (int i = 1; i < rBufCursor; i += 1) {
          Keyboard.write(rBuf[i]);
      }
  }

  if (rBuf[0] == POWER_EVT_START && rBufCursor >= 3) {
    // Power event: [252, type, duration_low, duration_high, 251]
    switch (rBuf[1]) {
      case POWER_EVT_TYPE_PRESS: {
        // Duration = rBuf[2] | (rBuf[3] << 8) if needed, else just rBuf[2]
        int durationMs = rBuf[2];  // 0-255ms
        powerButtonPress(durationMs);
        break;
      }
      default:
        break;
    }
  }
}

void reset_r_buf() {
   rBufCursor = 0;
   rBuf[0] = 0;
}

// Power button control
void powerButtonPress(int durationMs) {
  digitalWrite(POWER_BTN_PIN, HIGH);
  delay(durationMs);
  digitalWrite(POWER_BTN_PIN, LOW);
}

void loop() {
  int curVal;
  while (Serial1.available() > 0) {
    curVal = Serial1.read();
    
    if (curVal == EVT_END) {
      parse_r_buf();
      blink();
      reset_r_buf();
    } else {
      if (rBufCursor == 0) {
        if (curVal == KB_EVT_START || curVal == MOUSE_EVT_START || curVal == KEY_SEQUENCE_EVT_START || curVal == POWER_EVT_START) {
          rBuf[rBufCursor] = curVal;
          rBufCursor += 1;
        }
      } else {
        if (rBufCursor < R_BUF_LEN) {
           rBuf[rBufCursor] = curVal;
           rBufCursor += 1;
        } else {
          // overflow, reset rBuf
          rBuf[0] = 0;
        }
      }
    }
  }
}
