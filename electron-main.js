const { app, BrowserWindow } = require('electron');
const path = require('path');
const { spawn } = require('child_process');
const http = require('http');

let mainWindow;
let serverProcess;

function startBackendServer() {
  console.log('Starting backend server...');
  const serverPath = path.join(__dirname, 'server', 'index.js');
  console.log('Server path:', serverPath);
  console.log('__dirname:', __dirname);
  console.log('File exists:', require('fs').existsSync(serverPath));
  
  serverProcess = spawn('node', [serverPath], {
    cwd: __dirname,
    stdio: 'inherit',
    shell: true
  });

  serverProcess.on('error', (err) => {
    console.error('Failed to start server:', err);
  });

  serverProcess.on('close', (code) => {
    console.log(`Server process exited with code ${code}`);
  });
}

function checkServerReady(callback, attempts = 0) {
  const maxAttempts = 30; // 30 lần x 1000ms = 30 giây
  const delayMs = 1000; // Tăng từ 500ms lên 1000ms
  
  http.get('http://localhost:8000', (res) => {
    console.log('✅ Server is ready!');
    callback(true);
  }).on('error', (err) => {
    if (attempts < maxAttempts) {
      console.log(`⏳ Waiting for server... (${attempts + 1}/${maxAttempts})`);
      setTimeout(() => checkServerReady(callback, attempts + 1), delayMs);
    } else {
      console.error('❌ Server failed to start after 30 seconds');
      callback(false);
    }
  });
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      enableRemoteModule: false
    },
    icon: path.join(__dirname, 'icon.png')
  });

  mainWindow.webContents.openDevTools();

  // Log to renderer console
  mainWindow.webContents.on('did-finish-load', () => {
    mainWindow.webContents.executeJavaScript(`
      console.log('Electron app loaded');
      console.log('App path:', '${app.getAppPath()}');
    `);
  });

  // Hiển thị loading page
  mainWindow.loadURL(`data:text/html,<html><body style="margin:0;display:flex;align-items:center;justify-content:center;height:100vh;font-family:sans-serif;background:#1e1e1e;color:#fff"><div style="text-align:center"><h1>🚀 Open IP-KVM</h1><p>Đang khởi động server...</p><div style="margin-top:20px;width:200px;height:4px;background:#333;border-radius:2px"><div style="width:0%;height:100%;background:#0078d4;border-radius:2px;animation:load 2s ease-in-out infinite">@keyframes load{0%{width:0%}50%{width:100%}100%{width:0%}}</div></div></div></body></html>`);

  // Đợi server sẵn sàng
  checkServerReady((ready) => {
    if (ready) {
      console.log('Loading http://localhost:8000');
      mainWindow.loadURL('http://localhost:8000');
    } else {
      mainWindow.loadURL(`data:text/html,<html><body style="margin:0;display:flex;align-items:center;justify-content:center;height:100vh;font-family:sans-serif;background:#1e1e1e;color:#fff"><div style="text-align:center"><h1>❌ Lỗi khởi động</h1><p>Server không thể khởi động sau 10 giây</p><p style="color:#888">Kiểm tra console để xem chi tiết lỗi</p></div></body></html>`);
    }
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

app.on('ready', () => {
  startBackendServer();
  createWindow();
});

app.on('window-all-closed', () => {
  if (serverProcess) {
    serverProcess.kill();
  }
  app.quit();
});

app.on('activate', () => {
  if (mainWindow === null) {
    createWindow();
  }
});
