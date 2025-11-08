const { spawn } = require('child_process');
const http = require('http');
let shell;
let server;

function startMJPGStreamer(opt) {
  if (process.platform === 'win32') {
    // Windows: Use ffmpeg to stream MJPEG from webcam to stdout, serve via HTTP
    if (shell || server) {
      return;
    }
    return new Promise((resolve, reject) => {
      const deviceName = opt.device || 'video="No Capture Device"';
      const port = opt.stream_port || 8090;
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
      shell = spawn('ffmpeg', ffmpegArgs, { shell: true });

      let clients = [];

      shell.stderr.on('data', (data) => {
        const str = data.toString('utf-8');
        console.log(str);
        if (str.includes('Error opening input')) {
          reject(new Error('ffmpeg could not open video device. Check device name in config.'));
        }
      });
      shell.on('close', (code) => {
        reject(new Error(`ffmpeg exited with code ${code}`));
      });

      // Parse JPEG frames and send with MJPEG boundaries
      let buffer = Buffer.alloc(0);
      let lastFrame = null;
      
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

      // HTTP MJPEG server - hỗ trợ cả / và /?action=stream và /?action=snapshot
      server = http.createServer((req, res) => {
        const url = new URL(req.url, `http://${req.headers.host}`);
        const action = url.searchParams.get('action');
        
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
        
        console.log(`[HTTP] Request: ${req.url}, action=${action}`);
        
        if (action === 'snapshot') {
          // Chỉ trả về 1 frame JPEG (giống mjpg-streamer trên Linux)
          console.log('[HTTP] Serving snapshot');
          if (lastFrame) {
            res.writeHead(200, {
              'Content-Type': 'image/jpeg',
              'Cache-Control': 'no-cache',
              'Content-Length': lastFrame.length,
            });
            res.end(lastFrame);
          } else {
            // Nếu chưa có frame, trả về placeholder hoặc chờ frame đầu tiên
            res.writeHead(200, { 
              'Content-Type': 'text/plain',
              'Cache-Control': 'no-cache'
            });
            res.end('Waiting for first frame...');
          }
        } else if (url.pathname === '/' || action === 'stream') {
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
        resolve(shell);
      });
    });
  }
  // Linux: original mjpg_streamer
  if (shell) {
    return;
  }
  return new Promise((resolve, reject) => {
    const cmd = [
      'mjpg_streamer',
      '-i',
      `'input_uvc.so -d ${opt.device} -r ${opt.res} -f ${opt.fps} -n'`,
      '-o',
      `'output_http.so -p ${opt.stream_port} -n'`,
    ].join(' ');
    shell = spawn('bash', ['-c', cmd]);
    shell.stdout.on('data', (data) => {
      console.log(data.toString('utf-8'));
    });
    shell.stderr.on('data', (data) => {
      const str = data.toString('utf-8');
      console.log(str);
      if (str.indexOf('HTTP TCP port') > -1) {
        console.log('mjpg_streamer start')
        resolve(shell);
      }
    });
    shell.on('close', (code) => {
      reject(new Error(`mjpg_streamer exited with code ${code}`));
    });
  });
}

module.exports.startMJPGStreamer = startMJPGStreamer;
