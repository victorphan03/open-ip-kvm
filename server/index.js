const path = require('path');
const url = require('url');
const fs = require('fs');
const config = require("./config.json");
const bcrypt = require('bcrypt');
const bodyParser = require('koa-bodyparser');
const jwt = require('jsonwebtoken');
const koaBody = require('koa-body');
const http = require('http');
const SECRET_KEY = 'f09a4b4314e022393e9676e26e7e7ba5808a115ebdf323290ff0c7ec0e834d78'; // Đổi thành chuỗi bí mật của bạn

config.app_title = config.app_title || 'Open IP-KVM';
config.mjpg_streamer.stream_port = config.mjpg_streamer.stream_port || 8010;

const ws = require('ws');
const Koa = require('koa');
const KoaStaic = require('koa-static');

const { startSerial } = require('./serial.js');
const { startMJPGStreamer } = require('./mjpg-streamer.js');


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

    // Đặt bodyParser lên đầu, trước các route
    app.use(bodyParser());
    // Route /login trả về login.html (GET)
    app.use(async (ctx, next) => {
      if (ctx.path === '/login' && ctx.method === 'GET') {
        ctx.type = 'html';
        ctx.body = fs.readFileSync(path.join(__dirname, '../public/login.html'));
        return;
      }
      await next();
    });

    // Route /login xử lý đăng nhập (POST)
    app.use(async (ctx, next) => {
      if (ctx.path === '/login' && ctx.method === 'POST') {
        const { username, password } = ctx.request.body;
        if (
          username === config.username &&
          bcrypt.compareSync(password, config.password_hash)
        ) {
          // Tạo token JWT
          const token = jwt.sign({ username }, SECRET_KEY, { expiresIn: '1d' });
          ctx.body = { token };
        } else {
          ctx.status = 401;
          ctx.body = 'Login failed';
        }
        return;
      }
      await next();
    });

    // Middleware kiểm tra token cho các API cần bảo vệ
    app.use(async (ctx, next) => {
      // Chỉ kiểm tra với /api/config
      if (ctx.path === '/api/config') {
        const authHeader = ctx.headers.authorization;
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
          ctx.status = 401;
          ctx.body = 'Unauthorized';
          return;
        }
        const token = authHeader.slice(7);
        try {
          jwt.verify(token, SECRET_KEY);
          await next();
        } catch (e) {
          ctx.status = 401;
          ctx.body = 'Invalid token';
        }
        return;
      }
      await next();
    });

    app.use(KoaStaic(path.join(__dirname, '../public')));

    const server = app.listen(config.listen_port);
    console.log(`listen on ${config.listen_port}...`);

    app.use(async function router(ctx) {
      if (ctx.path === '/api/config') {
        ctx.body = config;
      } else if (ctx.path === '/api/stream') {
        // Proxy stream từ mjpg-streamer
        const streamUrl = `http://127.0.0.1:${config.mjpg_streamer.stream_port}/?action=stream`;
        
        return new Promise((resolve) => {
          const req = http.get(streamUrl, (res) => {
            ctx.set(res.headers);
            ctx.body = res;
            resolve();
          });
          
          req.on('error', (err) => {
            ctx.status = 500;
            ctx.body = 'Stream not available';
            resolve();
          });
        });
      } else if (ctx.path === '/api/snapshot') {
        // Proxy snapshot từ mjpg-streamer
        const snapshotUrl = `http://127.0.0.1:${config.mjpg_streamer.stream_port}/?action=snapshot`;
        
        return new Promise((resolve) => {
          const req = http.get(snapshotUrl, (res) => {
            ctx.set(res.headers);
            ctx.body = res;
            resolve();
          });
          
          req.on('error', (err) => {
            ctx.status = 500;
            ctx.body = 'Snapshot not available';
            resolve();
          });
        });
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

