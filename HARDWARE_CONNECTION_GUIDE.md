# Hướng dẫn kết nối RP2040 với Mainboard

## Tổng quan
Hướng dẫn này mô tả cách kết nối RP2040 với các thành phần sau của mainboard:
- Nút Power (bật/tắt máy tính)
- Nút Reset 
- LED Power (đèn nguồn)
- LED HDD (đèn ổ cứng)

## Linh kiện cần thiết

### Điện tử
- **2x Transistor NPN**: 2N2222 hoặc BC547
- **4x Điện trở 1kΩ**: Bảo vệ base transistor
- **2x Điện trở 10kΩ**: Pull-down cho đọc LED
- **1x Breadboard** hoặc PCB prototyping
- **Dây jumper**: Male-to-male và male-to-female

### Công cụ
- Multimeter (kiểm tra mạch)
- Tua vít nhỏ
- Kìm tuốt dây

## Cấu hình chân RP2040

```
RP2040 Pin Assignment:
├── Pin 2: Điều khiển nút Power qua transistor
├── Pin 3: Điều khiển nút Reset qua transistor  
├── Pin 4: Đọc trạng thái LED Power
├── Pin 5: Đọc trạng thái LED HDD
└── GND: Ground chung với mainboard
```

## Sơ đồ kết nối chi tiết

### 1. Điều khiển nút Power (Pin 2)

```
RP2040 Pin 2 ──[1kΩ]──┐
                       │
                    Base (B)
                   2N2222
                       │
              ┌────Collector (C)
              │        │
              │     Emitter (E)
              │        │
              │       GND
              │
        Power Button Header
        trên Mainboard
        PWR_BTN+ ── PWR_BTN-
```

**Bảng kết nối:**
| RP2040 | Linh kiện | Mainboard |
|--------|-----------|-----------|
| Pin 2 | Qua R1kΩ → Base transistor | - |
| GND | Emitter transistor | PWR_BTN- |
| - | Collector transistor | PWR_BTN+ |

### 2. Điều khiển nút Reset (Pin 3)

```
RP2040 Pin 3 ──[1kΩ]──┐
                       │
                    Base (B)
                   2N2222
                       │
              ┌────Collector (C)
              │        │
              │     Emitter (E)
              │        │
              │       GND
              │
        Reset Button Header
        trên Mainboard
        RST_BTN+ ── RST_BTN-
```

**Bảng kết nối:**
| RP2040 | Linh kiện | Mainboard |
|--------|-----------|-----------|
| Pin 3 | Qua R1kΩ → Base transistor | - |
| GND | Emitter transistor | RST_BTN- |
| - | Collector transistor | RST_BTN+ |

### 3. Đọc LED Power (Pin 4)

```
Mainboard PWR_LED+
        │
        └──[10kΩ]──┐
                   │
               RP2040 Pin 4
                   │
                  [10kΩ] (pull-down)
                   │
                  GND ← PWR_LED-
```

**Bảng kết nối:**
| Mainboard | Linh kiện | RP2040 |
|-----------|-----------|--------|
| PWR_LED+ | Qua R10kΩ | Pin 4 |
| PWR_LED- | Trực tiếp | GND |
| - | R10kΩ pull-down Pin 4 | GND |

### 4. Đọc LED HDD (Pin 5)

```
Mainboard HDD_LED+
        │
        └──[10kΩ]──┐
                   │
               RP2040 Pin 5
                   │
                  [10kΩ] (pull-down)
                   │
                  GND ← HDD_LED-
```

**Bảng kết nối:**
| Mainboard | Linh kiện | RP2040 |
|-----------|-----------|--------|
| HDD_LED+ | Qua R10kΩ | Pin 5 |
| HDD_LED- | Trực tiếp | GND |
| - | R10kΩ pull-down Pin 5 | GND |

## Vị trí Front Panel Connectors

### Tìm Front Panel Header trên mainboard

```
Front Panel Connector (thường ở góc dưới phải):

PWR SW    [●]  [●]  ← Power Switch
RST SW    [●]  [●]  ← Reset Switch  
PWR LED   [●]  [●]  ← Power LED
HDD LED   [●]  [●]  ← HDD Activity LED

Chú thích:
[●] = Pin header
+ = Chân dương  
- = Chân âm/GND
```

### Nhận biết các connector

| Tên trên PCB | Chức năng | Ghi chú |
|--------------|-----------|---------|
| PWR SW, POWER BTN | Nút nguồn | 2 chân, không phân cực |
| RST, RESET | Nút reset | 2 chân, không phân cực |
| PWR LED, POWER LED | LED nguồn | 2 chân, có phân cực |
| HDD LED, IDE LED | LED ổ cứng | 2 chân, có phân cực |

## Hướng dẫn lắp đặt

### Bước 1: Chuẩn bị
1. **Tắt nguồn máy tính** hoàn toàn
2. **Rút dây nguồn** khỏi PSU
3. **Chạm tay vào vỏ case** để xả tĩnh điện
4. **Chuẩn bị workspace** sạch sẽ, đủ ánh sáng

### Bước 2: Tháo dây cũ
1. **Chụp ảnh** vị trí dây cũ để tham khảo
2. **Ghi chú** từng connector trước khi tháo
3. **Tháo nhẹ nhàng** các dây front panel khỏi mainboard
4. **Kiểm tra** tình trạng các dây

### Bước 3: Lắp mạch trung gian

#### 3.1. Chuẩn bị breadboard
```
Breadboard Layout:

Row 1: RP2040 connections
Row 2: Transistor 1 (Power control)  
Row 3: Transistor 2 (Reset control)
Row 4: Resistors
Row 5: Mainboard connections
```

#### 3.2. Lắp transistor điều khiển Power
1. **Cắm transistor 2N2222** vào breadboard
2. **Kết nối Base** ← RP2040 Pin 2 (qua R1kΩ)
3. **Kết nối Collector** → PWR_BTN+ mainboard
4. **Kết nối Emitter** → GND chung

#### 3.3. Lắp transistor điều khiển Reset
1. **Cắm transistor 2N2222** thứ hai
2. **Kết nối Base** ← RP2040 Pin 3 (qua R1kΩ)
3. **Kết nối Collector** → RST_BTN+ mainboard  
4. **Kết nối Emitter** → GND chung

### Bước 4: Kết nối đọc LED

#### 4.1. LED Power
1. **PWR_LED+ mainboard** → R10kΩ → **RP2040 Pin 4**
2. **PWR_LED- mainboard** → **GND chung**
3. **RP2040 Pin 4** → R10kΩ pull-down → **GND**

#### 4.2. LED HDD  
1. **HDD_LED+ mainboard** → R10kΩ → **RP2040 Pin 5**
2. **HDD_LED- mainboard** → **GND chung**
3. **RP2040 Pin 5** → R10kΩ pull-down → **GND**

### Bước 5: Kết nối nguồn và GND
1. **RP2040 GND** → **Mainboard GND** (có thể dùng PWR_BTN-)
2. **RP2040 VCC** → **USB 5V** hoặc **Mainboard 5V**
3. **Kiểm tra** tất cả kết nối GND

## Kiểm tra và test

### Test 1: Kiểm tra mạch bằng multimeter
```
Checklist:
□ Điện trở giữa RP2040 Pin 2 và Base transistor: ~1kΩ
□ Điện trở giữa RP2040 Pin 3 và Base transistor: ~1kΩ  
□ Điện trở pull-down Pin 4, Pin 5: ~10kΩ
□ Continuity GND: RP2040 ↔ Mainboard
□ Không có short circuit giữa các pin
```

### Test 2: Test software
1. **Upload Arduino code** lên RP2040
2. **Mở Serial Monitor** (19200 baud)
3. **Kiểm tra LED builtin** nhấp nháy khi khởi động

### Test 3: Test từng chức năng

#### Test Power Button
```
Serial Command: [252, 1, 251]
Expected: Máy tính bật/tắt
```

#### Test Reset Button  
```
Serial Command: [252, 2, 251]
Expected: Máy tính reset
```

#### Test LED Reading
```
Serial Command: [252, 3, 251]  
Expected: Nhận về trạng thái LED qua serial
```

## Troubleshooting

### Vấn đề: Nút Power/Reset không hoạt động

**Nguyên nhân có thể:**
- Transistor hỏng hoặc nối sai chân
- Điện trở base quá lớn (>2kΩ)
- Không có GND chung
- Polarity connector sai

**Cách khắc phục:**
1. Kiểm tra lại sơ đồ chân transistor
2. Đo điện áp base khi RP2040 xuất HIGH
3. Test transistor bằng cách nối trực tiếp base với 3.3V
4. Kiểm tra continuity từ RP2040 đến transistor

### Vấn đề: Không đọc được trạng thái LED

**Nguyên nhân có thể:**
- LED mainboard bị hỏng
- Điện trở phân áp không phù hợp
- Pin đọc không có pull-down
- Voltage divider không đúng

**Cách khắc phục:**
1. Đo điện áp trực tiếp tại LED header mainboard
2. Kiểm tra giá trị điện trở 10kΩ
3. Đo điện áp tại Pin 4, Pin 5 RP2040
4. Test với LED ngoài để xác nhận

### Vấn đề: Hệ thống không ổn định

**Nguyên nhân có thể:**
- GND không chung
- Nhiễu điện từ
- Nguồn cấp không ổn định
- Dây kết nối quá dài

**Cách khắc phục:**
1. Đảm bảo GND chung tốt
2. Thêm capacitor lọc nhiễu 100nF
3. Rút ngắn dây kết nối
4. Sử dụng nguồn ổn định

## Lưu ý an toàn

### ⚠️ Cảnh báo quan trọng
- **Luôn tắt nguồn** trước khi kết nối
- **Không chạm** vào linh kiện khi máy đang bật
- **Kiểm tra polarity** LED trước khi kết nối
- **Sử dụng ESD strap** khi có thể

### 🔒 Bảo vệ thiết bị
- **Dùng điện trở bảo vệ** cho mọi kết nối
- **Không nối trực tiếp** RP2040 với mainboard
- **Kiểm tra hai lần** trước khi cấp nguồn
- **Backup bootloader** RP2040 trước khi test

## Kết luận

Sau khi hoàn thành các bước trên, bạn sẽ có:

✅ **Điều khiển từ xa**: Bật/tắt và reset máy tính qua web interface

✅ **Giám sát trạng thái**: Theo dõi LED power và HDD activity realtime  

✅ **Tích hợp hoàn chỉnh**: Hệ thống KVM hoạt động đầy đủ chức năng

**Tài liệu tham khảo:**
- Arduino RP2040 Pinout: https://docs.arduino.cc/hardware/nano-rp2040-connect
- ATX Power Connector Standard: https://en.wikipedia.org/wiki/ATX
- Transistor 2N2222 Datasheet: Standard NPN transistor documentation

---
*Tài liệu được tạo cho dự án Open IP-KVM*  
*Phiên bản: 1.0 - Ngày: 18/09/2025*