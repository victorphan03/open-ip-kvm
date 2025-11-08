# Hướng dẫn Build Electron App cho Windows

## Yêu cầu
- Node.js 14+ đã cài đặt
- Git đã cài đặt (để cài electron dependencies)
- Windows 10/11

## Bước 1: Cài đặt Git
Nếu chưa có Git, tải và cài đặt tại: https://git-scm.com/download/win

## Bước 2: Cài đặt Electron dependencies
Sau khi cài Git, chạy lệnh sau trong PowerShell:

```powershell
npm install --save-dev electron electron-builder
```

## Bước 3: Chạy app Electron (Development)
Để test app Electron trước khi build:

```powershell
npm run electron
```

Hoặc với môi trường development:

```powershell
npm run electron-dev
```

## Bước 4: Build app Windows (.exe)
Để build app thành file .exe cài đặt:

```powershell
npm run build
```

File build sẽ nằm trong thư mục `dist/`.

## Lưu ý
- App sẽ tự động khởi động server backend khi mở
- Cần đảm bảo cổng COM và camera đã được cấu hình đúng trong `server/config.json`
- Cần có ffmpeg trong PATH để stream camera hoạt động trên Windows

## Cấu trúc Electron App
- `electron-main.js`: File chính của Electron, khởi động server và tạo cửa sổ
- `server/`: Backend Node.js server
- `public/`: Frontend static files
- `package.json`: Cấu hình build và dependencies

## Troubleshooting
### Lỗi khi cài electron
- Đảm bảo Git đã được cài đặt và có trong PATH
- Thử xóa `node_modules` và chạy lại `npm install`

### App không khởi động
- Kiểm tra log trong console
- Đảm bảo không có app nào khác đang chiếm cổng 8000 hoặc 8010

### Stream camera không hoạt động
- Đảm bảo ffmpeg đã được cài đặt và có trong PATH
- Kiểm tra tên thiết bị camera trong `server/config.json`
