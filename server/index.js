const path = require('path');
const url = require('url');
const fs = require('fs');

const config = require("./config.json");

config.app_title = config.app_title || 'Open IP-KVM';
config.mjpg_streamer.stream_port = config.mjpg_streamer.stream_port || 8010;

const ws = require('ws');
const Koa = require('koa');
const KoaStaic = require('koa-static');

const { startSerial } = require('./serial.js');
const { startMJPGStreamer } = require('./mjpg-streamer.js');
const { listSerialPorts, listVideoDevices } = require('./device-detector.js');


async function start() {

  try {
    const writeSerial = startSerial(config.serialport);
    await startMJPGStreamer(config.mjpg_streamer);

    function websocketHandler(ws) {
      console.log('new websocket connection');
      ws.on('message', function message(data) {
        const msg = JSON.parse(data.toString());
        switch (msg.type) {
          case 'write_serial':
            writeSerial(msg.payload);
            break;
        }
      });

      ws.send(JSON.stringify({
        type: 'welcome',
        payload: 'Open IP-KVM Server'
      }));
    }


    const app = new Koa();
    app.use(KoaStaic(path.join(__dirname, '../public')));

    const server = app.listen(config.listen_port);
    console.log(`listen on ${config.listen_port}...`);

    app.use(async function router(ctx) {
      if (ctx.path === '/api/config') {
        if (ctx.method === 'GET') {
          ctx.body = config;
        } else if (ctx.method === 'POST') {
          // Lưu config mới
          let body = '';
          ctx.req.on('data', chunk => body += chunk);
          await new Promise(resolve => ctx.req.on('end', resolve));
          
          try {
            const newConfig = JSON.parse(body);
            const configPath = path.join(__dirname, 'config.json');
            fs.writeFileSync(configPath, JSON.stringify(newConfig, null, 2));
            
            ctx.body = { success: true, message: 'Config saved. Restarting...' };
            
            // Restart app sau 1 giây
            setTimeout(() => {
              process.exit(0);
            }, 1000);
          } catch (e) {
            ctx.status = 400;
            ctx.body = { success: false, message: e.message };
          }
        }
      } else if (ctx.path === '/api/devices') {
        // API để list devices (serial ports và cameras)
        try {
          const [serialPorts, videoDevices] = await Promise.all([
            listSerialPorts(),
            listVideoDevices()
          ]);
          
          ctx.body = {
            serialPorts: serialPorts,
            videoDevices: videoDevices
          };
        } catch (e) {
          ctx.status = 500;
          ctx.body = { error: e.message };
        }
      } else if (ctx.path === '/api/power') {
        // Power control API
        if (ctx.method === 'POST') {
          let body = '';
          ctx.req.on('data', chunk => body += chunk);
          await new Promise(resolve => ctx.req.on('end', resolve));
          
          try {
            const cmd = JSON.parse(body);
            const payload = [252]; // POWER_EVT_START
            
            switch(cmd.action) {
              case 'press':
              case 'toggle':
                // Short press (toggle power on/off)
                payload.push(1); // POWER_EVT_TYPE_PRESS
                payload.push(cmd.duration || 200); // Default 200ms
                break;
              case 'hold':
              case 'shutdown':
                // Long press (force shutdown)
                payload.push(1); // POWER_EVT_TYPE_PRESS
                payload.push(cmd.duration || 5000); // Default 5 seconds
                break;
              default:
                ctx.status = 400;
                ctx.body = { error: 'Unknown action', validActions: ['press', 'toggle', 'hold', 'shutdown'] };
                return;
            }
            
            payload.push(251); // EVT_END
            
            console.log('[Power] Executing action:', cmd.action, 'duration:', payload[2], 'ms');
            writeSerial(payload);
            ctx.body = { success: true, action: cmd.action, duration: payload[2] };
          } catch (e) {
            ctx.status = 400;
            ctx.body = { error: e.message };
          }
        } else {
          ctx.status = 405;
          ctx.body = { error: 'Method not allowed' };
        }
      }
    });

    const wsInstance = new ws.WebSocketServer({ noServer: true });
    server.on('upgrade', function upgrade(request, socket, head) {
      const { pathname } = url.parse(request.url);

      if (pathname === '/websocket') {
        wsInstance.handleUpgrade(request, socket, head, function done(ws) {
          wsInstance.emit('connection', ws, request);
        });
      } else {
        socket.destroy();
      }
    });

    wsInstance.on('connection', websocketHandler);
  } catch(e) {
    console.log(e);
    process.exit(1);
  }

}

start();

