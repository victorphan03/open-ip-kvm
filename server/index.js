    const path = require('path');
    const url = require('url');
    const fs = require('fs');
    const config = require("./config.json");
    const bcrypt = require('bcryptjs');
    const bodyParser = require('koa-bodyparser');
    const jwt = require('jsonwebtoken');
    const koaBody = require('koa-body');
    const http = require('http');
    const ws = require('ws');
    const Koa = require('koa');
    const KoaStaic = require('koa-static');
    const { startSerial } = require('./serial.js');
    const { startMJPGStreamer } = require('./mjpg-streamer.js');
    const SECRET_KEY = 'f09a4b4314e022393e9676e26e7e7ba5808a115ebdf323290ff0c7ec0e834d78'; // Đổi thành chuỗi bí mật của bạn

    config.app_title = config.app_title || 'Open IP-KVM';
    config.mjpg_streamer.stream_port = config.mjpg_streamer.stream_port || 8010;

    // ...existing code...
      const app = new Koa();

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

      app.use(bodyParser());

      // Middleware kiểm tra login cho truy cập /
      app.use(async (ctx, next) => {
        if (ctx.path === '/' && ctx.method === 'GET') {
          const authHeader = ctx.headers.authorization || ctx.cookies.get('token') || '';
          let token = '';
          if (authHeader.startsWith('Bearer ')) {
            token = authHeader.slice(7);
          } else {
            token = authHeader;
          }
          try {
            jwt.verify(token, SECRET_KEY);
            await next();
          } catch (e) {
            ctx.type = 'html';
            ctx.body = fs.readFileSync(path.join(__dirname, '../public/login.html'));
            return;
          }
        } else {
          await next();
        }
      });

      app.use(KoaStaic(path.join(__dirname, '../public')));

    // Middleware xử lý login
    app.use(async (ctx, next) => {
      if (ctx.path === '/login' && ctx.method === 'POST') {
        try {
          const { username, password } = ctx.request.body;
          console.log(username);
          if (
            username === config.username &&
            bcrypt.compareSync(password, config.password_hash)
          ) {
            // Tạo token JWT
            const token = jwt.sign({ username }, SECRET_KEY, { expiresIn: '1d' });
            // Set cookie token
            ctx.cookies.set('token', token, {
              httpOnly: false,
              maxAge: 86400 * 1000,
              path: '/',
              sameSite: 'strict'
            });
            ctx.body = { token };
          } else {
            ctx.status = 401;
            ctx.body = 'Login failed';
          }
        } catch (e) {
          ctx.status = 400;
          ctx.body = 'Invalid request';
        }
        return;
      }
      // Endpoint /logout: xóa cookie và chuyển hướng về /login
      if (ctx.path === '/logout' && ctx.method === 'GET') {
        // Xóa cookie ở path / và path hiện tại
        ctx.cookies.set('token', '', {
          httpOnly: false,
          maxAge: 0,
          expires: new Date(0),
          path: '/',
          sameSite: 'lax',
          domain: ctx.hostname
        });
        ctx.cookies.set('token', '', {
          httpOnly: false,
          maxAge: 0,
          expires: new Date(0),
          path: ctx.path,
          sameSite: 'lax',
          domain: ctx.hostname
        });
        ctx.redirect('/login');
        return;
      }
      await next();
    });

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

