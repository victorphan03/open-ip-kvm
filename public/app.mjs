import * as ws from './ws.mjs';
import * as kb from './kb.mjs';
import * as mouse from './mouse.mjs';

new Vue({
  el: '#app',
  data: {
    // serviceHost: '10.0.0.235',
    serviceHost: location.hostname,
    streamSrc: '',
    $channel: null,
    isKeyCaptureActive: false,
    isPointorLocked: false,
    mouseMoveSlice: [0, 0],
    activeDialog: '',
    pasteContent: '',
  },
  mounted() {
    this.init();
  },
  methods: {
    async init() {
      try {
        const config = await this.fetchConfig();
        document.title = config.app_title? config.app_title : 'Open IP-KVM';
        const streamOk = await this.pingStream(config.mjpg_streamer.stream_port);
        if (!streamOk) {
          throw new Error(
            'Video stream is not ready, please check mjpeg process'
          );
        }
        
        // Auto-detect WebSocket protocol and port based on current page
        const wsProtocol = location.protocol === 'https:' ? 'wss:' : 'ws:';
        const wsPort = location.protocol === 'https:' ? '' : `:${config.listen_port}`;
        const wsUrl = `${wsProtocol}//${this.serviceHost}${wsPort}/websocket`;
        
        console.log('WebSocket URL:', wsUrl);
        this.$channel = await ws.init(wsUrl);
        this.bindKeyHandler();
        this.bindMouseHandler();

        this.streamSrc = `/api/stream`;
      } catch (e) {
        alert(e.toString());
      }
    },
    async pingStream(port) {
      try {
        const pingRes = await fetch(`/api/snapshot`);
        return pingRes.status === 200;
      } catch (e) {
        return false;
      }
    },
    async fetchConfig() {
      try {
        const res = await fetch('/api/config');
        return res.json();
      } catch (e) {
        return null;
      }
    },
    bindKeyHandler() {
      document.addEventListener('keydown', (evt) => {
        if (!this.isKeyCaptureActive) {
          if (evt.key === 'Enter' && !this.activeDialog) {
            this.setScreenFocus(true);
          }
          return;
        }

        evt.preventDefault();

        if (evt.repeat) {
          return;
        }

        if (evt.key === 'Escape' && evt.shiftKey) {
          this.setScreenFocus(false);
          return;
        }
        kb.sendEvent(this.$channel, evt.key, 'keydown');
      });

      document.addEventListener('keyup', (evt) => {
        if (!this.isKeyCaptureActive) {
          return;
        }
        kb.sendEvent(this.$channel, evt.key, 'keyup');
      });
    },
    bindMouseHandler() {
      const mouseMoveSlice = this.mouseMoveSlice;

      document.addEventListener('pointerlockchange', (evt) => {
        this.isPointorLocked =
          document.pointerLockElement &&
          document.pointerLockElement.classList.contains('screen');
        mouse.sendEvent(this.$channel, '', 'reset');
      });

      window.setInterval(() => {
        if (mouseMoveSlice[0] !== 0 || mouseMoveSlice[1] !== 0) {
          mouse.sendEvent(this.$channel, mouseMoveSlice, 'move');
          mouseMoveSlice[0] = 0;
          mouseMoveSlice[1] = 0;
        }
      }, 30);

      mouse.sendEvent(this.$channel, 1, 'config-move-factor');
    },
    onScreenBlur() {
      this.isKeyCaptureActive = false;
      if (this.isPointorLocked) {
        this.setPointerLock(false);
      }
      kb.sendEvent(this.$channel, '', 'reset');
    },
    onScreenFocus() {
      this.setDialog();
      this.isKeyCaptureActive = true;
      kb.sendEvent(this.$channel, '', 'reset');
    },
    setScreenFocus(bool) {
      const screen = document.querySelector('.screen');
      screen[bool ? 'focus' : 'blur']();
    },
    setPointerLock(bool) {
      const screen = document.querySelector('.screen');
      if (bool) {
        try {
          this.setDialog();
          screen.requestPointerLock();
        } catch (e) {}
      } else {
        document.exitPointerLock();
      }
    },
    onScreenMouseMove(evt) {
      if (!this.isPointorLocked) {
        return;
      }
      this.mouseMoveSlice[0] += evt.movementX;
      this.mouseMoveSlice[1] += evt.movementY;
    },
    onScreenMouseDown(evt) {
      if (!this.isPointorLocked) {
        if (evt.button === 0) {
          this.setPointerLock(true);
        }
        return;
      }
      evt.preventDefault();
      mouse.sendEvent(this.$channel, evt.button, 'mousedown');
    },
    onScreenMouseUp(evt) {
      if (!this.isPointorLocked) {
        return;
      }
      mouse.sendEvent(this.$channel, evt.button, 'mouseup');
    },
    onScreenMouseWheel(evt) {
      if (!this.isPointorLocked) {
        return;
      }
      mouse.sendEvent(this.$channel, evt.wheelDeltaY, 'wheel');
    },
    doRemotePaste() {
      kb.sendSequence(this.$channel, this.pasteContent);
      this.pasteContent = '';
    },
    doLogout() {
      // Xóa token khỏi localStorage
      localStorage.removeItem('token');
      // Chuyển hướng về trang login
      window.location.href = '/login.html';
    },
    setDialog(name) {
      if (name) {
        this.setPointerLock(false);
        this.setScreenFocus(false);
        this.activeDialog = name;
      } else {
        this.activeDialog = '';
      }
    },
  },
});
