const { spawn } = require('child_process');
const http = require('http');
let shell;
let server;
let retryTimer;
let isRetrying = false;
let startTime;
let frameCount = 0;
let healthCheckTimer;

function startMJPGStreamer(opt) {
  if (process.platform === 'win32') {
    // Windows: Use ffmpeg to stream MJPEG from webcam to stdout, serve via HTTP
    if (server) {
      // Server đã chạy, chỉ retry ffmpeg process
      if (!shell || shell.killed) {
        startFFmpegProcess(opt);
      }
      return Promise.resolve();
    }
    return new Promise((resolve, reject) => {
      const port = opt.stream_port || 8090;
      let clients = [];
      let lastFrame = null; // Di chuyển ra ngoài để HTTP handler access được

      function startFFmpegProcess(options) {
        if (retryTimer) clearTimeout(retryTimer);
        
        const deviceName = options.device || 'video="No Capture Device"';
        let ffmpegDeviceArg = deviceName;
        // Nếu deviceName có khoảng trắng và không có dấu ngoặc kép, tự động thêm
        if (!deviceName.startsWith('video=')) {
          let dev = deviceName;
          if (dev.includes(' ') && !dev.startsWith('"') && !dev.endsWith('"')) {
            dev = `"${dev}"`;
          }
          ffmpegDeviceArg = `video=${dev}`;
        }
        // Build ffmpeg command: output individual JPEG frames to stdout
        const ffmpegArgs = [
          '-f', 'dshow',
          '-rtbufsize', '500M',
          '-i', ffmpegDeviceArg,
          '-f', 'image2pipe',
          '-vcodec', 'mjpeg',
          '-q:v', '2',
          'pipe:1'
        ];
        console.log('[Windows] Starting ffmpeg for MJPEG stream:', ffmpegArgs.join(' '));
        
        if (shell) {
          try { shell.kill(); } catch (e) {}
        }
        
        shell = spawn('ffmpeg', ffmpegArgs, { shell: true });
        isRetrying = false;
        startTime = Date.now();
        frameCount = 0;
        
        // Clear previous health check
        if (healthCheckTimer) clearTimeout(healthCheckTimer);
        
        // Health check: restart nếu không có frame nào sau 30s
        healthCheckTimer = setTimeout(() => {
          if (frameCount === 0) {
            console.warn('[MJPEG] No frames received in 30s, restarting ffmpeg...');
            if (shell) {
              try { shell.kill(); } catch (e) {}
            }
          }
        }, 30000);

        shell.stderr.on('data', (data) => {
          const str = data.toString('utf-8');
          console.log(str);
          if (str.includes('Error opening input') || str.includes('Could not enumerate')) {
            console.warn('[MJPEG] Video device not available, will retry in 10s...');
          }
        });
        
        shell.on('close', (code) => {
          console.log(`[MJPEG] ffmpeg exited with code ${code}`);
          if (healthCheckTimer) clearTimeout(healthCheckTimer);
          
          const uptime = Date.now() - startTime;
          const retryDelay = uptime < 5000 ? 3000 : 10000; // Exit sớm (<5s) → retry nhanh (3s), không thì 10s
          
          if (!isRetrying) {
            isRetrying = true;
            console.log(`[MJPEG] Will retry in ${retryDelay/1000} seconds... (uptime: ${Math.floor(uptime/1000)}s, frames: ${frameCount})`);
            retryTimer = setTimeout(() => startFFmpegProcess(options), retryDelay);
          }
        });

        // Parse JPEG frames and send with MJPEG boundaries
        let buffer = Buffer.alloc(0);
        
        shell.stdout.on('data', (chunk) => {
        buffer = Buffer.concat([buffer, chunk]);
        
        // JPEG starts with FF D8, ends with FF D9
        let start = 0;
        while (start < buffer.length - 1) {
          const jpegStart = buffer.indexOf(Buffer.from([0xFF, 0xD8]), start);
          if (jpegStart === -1) break;
          
          const jpegEnd = buffer.indexOf(Buffer.from([0xFF, 0xD9]), jpegStart + 2);
          if (jpegEnd === -1) break;
          
          const frame = buffer.slice(jpegStart, jpegEnd + 2);
          lastFrame = frame; // Lưu frame cuối cùng cho snapshot
          frameCount++; // Đếm frame
          
          // Send frame to all streaming clients with MJPEG boundary
          const frameData = Buffer.concat([
            Buffer.from(`--boundary\r\nContent-Type: image/jpeg\r\nContent-Length: ${frame.length}\r\n\r\n`),
            frame,
            Buffer.from('\r\n')
          ]);
          
          clients.forEach(client => {
            if (!client.writableEnded && client.isStream) {
              client.write(frameData);
            }
          });
          
          start = jpegEnd + 2;
        }
        
          // Keep remaining incomplete data
          buffer = buffer.slice(start);
        });
      }

      // HTTP MJPEG server - hỗ trợ /stream và /snapshot
      server = http.createServer((req, res) => {
        const url = new URL(req.url, `http://${req.headers.host}`);
        
        // Thêm CORS headers
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
        res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
        
        // Xử lý preflight request
        if (req.method === 'OPTIONS') {
          res.writeHead(204);
          res.end();
          return;
        }
        
        console.log(`[HTTP] Request: ${url.pathname}`);
        
        if (url.pathname === '/snapshot') {
          // Chỉ trả về 1 frame JPEG
          console.log('[HTTP] Serving snapshot');
          if (lastFrame) {
            res.writeHead(200, {
              'Content-Type': 'image/jpeg',
              'Cache-Control': 'no-cache',
              'Content-Length': lastFrame.length,
            });
            res.end(lastFrame);
          } else {
            // Nếu chưa có frame, trả về placeholder
            res.writeHead(200, { 
              'Content-Type': 'text/plain',
              'Cache-Control': 'no-cache'
            });
            res.end('Waiting for first frame...');
          }
        } else if (url.pathname === '/' || url.pathname === '/stream') {
          // Stream liên tục
          console.log('[HTTP] Serving stream');
          res.writeHead(200, {
            'Content-Type': 'multipart/x-mixed-replace; boundary=boundary',
            'Cache-Control': 'no-cache',
            'Connection': 'close',
            'Pragma': 'no-cache',
          });
          
          res.isStream = true;
          clients.push(res);
          
          req.on('close', () => {
            const idx = clients.indexOf(res);
            if (idx > -1) clients.splice(idx, 1);
          });
        } else {
          res.writeHead(404);
          res.end('Not Found');
        }
      });
      server.listen(port, () => {
        console.log(`MJPEG HTTP stream available at http://localhost:${port}/`);
        console.log('[MJPEG] Server ready, video will connect when device is available');
        // Start ffmpeg process
        startFFmpegProcess(opt);
        // Resolve ngay để không block app start
        resolve();
      });
    });
  }
  // Linux: µStreamer with retry
  if (shell) {
    return Promise.resolve();
  }
  
  return new Promise((resolve, reject) => {
    let resolved = false;
    
    function startUStreamerProcess(options) {
      if (retryTimer) clearTimeout(retryTimer);
      
      // µStreamer command - minimal flags cho UVC HDMI capture
      const cmd = [
        'ustreamer',
        '--device', options.device || '/dev/video0',
        '--host', '0.0.0.0',
        '--port', options.stream_port || 8090,
        '--format', 'MJPEG',
        '--quality', '80',
        '--allow-origin', '*',
        '--persistent',
      ].join(' ');
      
      console.log('[Linux] Starting µStreamer:', cmd);
      
      if (shell) {
        try { shell.kill(); } catch (e) {}
      }
      
      shell = spawn('bash', ['-c', cmd]);
      isRetrying = false;
      startTime = Date.now();
      
      if (healthCheckTimer) clearTimeout(healthCheckTimer);
      
      shell.stdout.on('data', (data) => {
        const str = data.toString('utf-8');
        console.log(str);
        
        // µStreamer logs "Listening HTTP on" khi ready
        if (str.includes('Listening HTTP on') || str.includes('HTTP: Listening')) {
          console.log('[MJPEG] µStreamer started successfully');
          if (!resolved) {
            resolved = true;
            resolve();
          }
        }
      });
      
      shell.stderr.on('data', (data) => {
        const str = data.toString('utf-8');
        console.log(str);
        
        if (str.includes('Listening HTTP on') || str.includes('HTTP: Listening')) {
          console.log('[MJPEG] µStreamer started successfully');
          if (!resolved) {
            resolved = true;
            resolve();
          }
        }
        if (str.includes('ERROR') || str.includes('error') || str.includes('Can\'t open device')) {
          console.warn('[MJPEG] Device not available, will retry...');
        }
      });
      
      shell.on('close', (code) => {
        console.log(`[MJPEG] µStreamer exited with code ${code}`);
        if (healthCheckTimer) clearTimeout(healthCheckTimer);
        
        const uptime = Date.now() - startTime;
        const retryDelay = uptime < 5000 ? 3000 : 10000;
        
        if (!isRetrying) {
          isRetrying = true;
          console.log(`[MJPEG] Will retry in ${retryDelay/1000} seconds... (uptime: ${Math.floor(uptime/1000)}s)`);
          retryTimer = setTimeout(() => startUStreamerProcess(options), retryDelay);
        }
      });
    }
    
    // Start process và resolve ngay sau 2s nếu chưa có tín hiệu thành công
    startUStreamerProcess(opt);
    setTimeout(() => {
      if (!resolved) {
        console.log('[MJPEG] Starting in background, will connect when device is ready');
        resolved = true;
        resolve();
      }
    }, 2000);
  });
}

module.exports.startMJPGStreamer = startMJPGStreamer;
