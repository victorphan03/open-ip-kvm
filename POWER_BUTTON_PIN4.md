# Power Button Control via Pin 4 (RP2040)

## 📝 Thay Đổi Trong Arduino Code

### Thêm vào file `virt-hid-arduino.ino`:

1. **Pin definition** (line 5):
   ```cpp
   #define POWER_EVT_START 252
   ```

2. **Pin 4 declaration** (line 23):
   ```cpp
   #define POWER_BTN_PIN 4
   ```

3. **Power event type** (line 34):
   ```cpp
   #define POWER_EVT_TYPE_PRESS 1
   ```

4. **Setup pin** (trong setup()):
   ```cpp
   pinMode(POWER_BTN_PIN, OUTPUT);
   digitalWrite(POWER_BTN_PIN, LOW);
   ```

5. **Power button function** (mới):
   ```cpp
   void powerButtonPress(int durationMs) {
     digitalWrite(POWER_BTN_PIN, HIGH);
     delay(durationMs);
     digitalWrite(POWER_BTN_PIN, LOW);
   }
   ```

6. **Parse power event** (trong parse_r_buf()):
   ```cpp
   if (rBuf[0] == POWER_EVT_START && rBufCursor >= 3) {
     switch (rBuf[1]) {
       case POWER_EVT_TYPE_PRESS:
         int durationMs = rBuf[2];
         powerButtonPress(durationMs);
         break;
     }
   }
   ```

7. **Accept POWER_EVT_START** (trong loop()):
   ```cpp
   if (curVal == KB_EVT_START || curVal == MOUSE_EVT_START || 
       curVal == KEY_SEQUENCE_EVT_START || curVal == POWER_EVT_START) {
   ```

---

## 🔌 Protocol Serial

### Gói Power Button Press
```
[252, 1, duration_ms, 251]
 ↑    ↑   ↑            ↑
 │    │   │            └─ EVT_END
 │    │   └─ Duration (0-255ms)
 │    └─ POWER_EVT_TYPE_PRESS
 └─ POWER_EVT_START
```

**Ví dụ:**
- `[252, 1, 200, 251]` → Bấn 200ms (toggle power)
- `[252, 1, 500, 251]` → Bấn 500ms (hold shutdown)

---

## ⚙️ Cách Dùng

### 1. Upload code Arduino
- Compile & upload virt-hid-arduino.ino
- Serial1 vẫn 115200 baud

### 2. Wiring (Opto-isolator)
```
Arduino Pin 4
  ↓ [470Ω resistor]
Opto-isolator (PC817) Pin 1
Opto-isolator Pin 2 → GND

Opto-isolator Pin 3 → Mainboard Power GND
Opto-isolator Pin 4 → Mainboard Power Button
```

### 3. Test
```
Gửi: [252, 1, 200, 251]
→ Arduino pin 4 HIGH (200ms)
→ Opto-isolator chập pins
→ Mainboard nhận tín hiệu bật/tắt
```

---

## 📊 Pin Mapping

| Component | Pin | Function |
|-----------|-----|----------|
| Arduino | 4 | Power button output |
| Opto-isolator | 1 | Input (LED) |
| Opto-isolator | 2 | Input GND |
| Opto-isolator | 3 | Output Collector |
| Opto-isolator | 4 | Output Emitter |
| Mainboard | JFP1 | Power button (GND) |
| Mainboard | JFP2 | Power button (PWR) |

---

## 🧪 Debug Commands (Browser Console)

```javascript
// Send power button press (200ms)
app.$channel.send(JSON.stringify({
  type: 'write_serial',
  payload: [252, 1, 200, 251]
}));

// Send power button press (500ms)
app.$channel.send(JSON.stringify({
  type: 'write_serial',
  payload: [252, 1, 200, 251]
}));
```

---

## 📝 Lưu Ý

1. **Giữ nguyên protocol cũ** (KB, Mouse, Sequence) ✅
2. **Thêm power event riêng** (byte 252) ✅
3. **Pin 4 cho RP2040** ✅
4. **Duration 0-255ms** (byte)
5. **LED blink vẫn hoạt động** ✅

---

## 🔄 Cấu Trúc File Cập Nhật

```cpp
// virt-hid-arduino.ino (đã update)
#include <Keyboard.h>
#include <Mouse.h>

#define KB_EVT_START 248
#define MOUSE_EVT_START 249
#define KEY_SEQUENCE_EVT_START 250
#define POWER_EVT_START 252         // ← THÊM
#define EVT_END 251

// ... existing defines ...

#define POWER_BTN_PIN 4              // ← THÊM
#define POWER_EVT_TYPE_PRESS 1       // ← THÊM

// ... setup() with pinMode(POWER_BTN_PIN) ...
// ... powerButtonPress(int) function ...
// ... parse_r_buf() with POWER_EVT_START handling ...
// ... loop() accepting POWER_EVT_START ...
```

---

## ⚡ Tiếp Theo

**Khi ready, cần implement:**
1. **Server API** (`/api/power`) - để gửi power command
2. **Web UI button** - "Power On/Off" button
3. **Test toàn bộ flow** - Browser → Server → Arduino → Mainboard

Cho tôi biết khi nào ready! 👍
