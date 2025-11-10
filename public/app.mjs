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
    settingsForm: {
      serialport: '',
      device: '',
      res: '',
      fps: 30,
      stream_port: 8010
    },
    currentConfig: null,
    availableDevices: {
      serialPorts: [],
      videoDevices: []
    },
    customDeviceName: ''
  },
  mounted() {
    this.init();
  },
  methods: {
    async init() {
      console.log('init app...');
      try {
        const config = await this.fetchConfig();
        console.log('Config loaded:', config);
        
        this.currentConfig = config;
        // Populate settings form với giá trị hiện tại
        this.settingsForm.serialport = config.serialport;
        this.settingsForm.device = config.mjpg_streamer.device;
        this.settingsForm.res = config.mjpg_streamer.res;
        this.settingsForm.fps = config.mjpg_streamer.fps;
        this.settingsForm.stream_port = config.mjpg_streamer.stream_port;
        
        document.title = config.app_title;
        const streamOk = await this.pingStream(config.mjpg_streamer.stream_port);
        console.log('Stream ping result:', streamOk);
        
        if (!streamOk) {
          throw new Error(
            'Video stream is not ready, please check mjpeg process'
          );
        }
        this.$channel = await ws.init(
          `ws://${this.serviceHost}:${config.listen_port}/websocket`
        );
        this.bindKeyHandler();
        this.bindMouseHandler();

        this.streamSrc = `http://${this.serviceHost}:${config.mjpg_streamer.stream_port}/?action=stream`;
        console.log('Stream URL:', this.streamSrc);
      } catch (e) {
        console.error('Init error:', e);
        alert(e.toString());
      }
    },
    async pingStream(port) {
      try {
        const url = `http://${this.serviceHost}:${port}/?action=snapshot`;
        console.log('Pinging stream at:', url);
        const pingRes = await fetch(url);
        console.log('Ping response status:', pingRes.status);
        return pingRes.status === 200;
      } catch (e) {
        console.error('Ping error:', e);
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
    setDialog(name) {
      if (name) {
        this.setPointerLock(false);
        this.setScreenFocus(false);
        this.activeDialog = name;
        
        // Khi mở settings, load danh sách devices
        if (name === 'settings') {
          this.loadAvailableDevices();
        }
      } else {
        this.activeDialog = '';
      }
    },
    async loadAvailableDevices() {
      try {
        console.log('Loading available devices...');
        const response = await fetch('/api/devices');
        console.log('Response status:', response.status);
        const devices = await response.json();
        console.log('Available devices:', devices);
        console.log('Video devices count:', devices.videoDevices ? devices.videoDevices.length : 0);
        console.log('Serial ports count:', devices.serialPorts ? devices.serialPorts.length : 0);
        
        this.availableDevices.serialPorts = devices.serialPorts || [];
        this.availableDevices.videoDevices = devices.videoDevices || [];
        
        console.log('Updated availableDevices:', this.availableDevices);
      } catch (e) {
        console.error('Error loading devices:', e);
      }
    },
    async refreshDevices() {
      await this.loadAvailableDevices();
      alert('Devices list refreshed!');
    },
    async saveSettings() {
      try {
        const newConfig = {
          ...this.currentConfig,
          serialport: this.settingsForm.serialport,
          mjpg_streamer: {
            device: this.settingsForm.device,
            res: this.settingsForm.res,
            fps: this.settingsForm.fps,
            stream_port: this.settingsForm.stream_port
          }
        };
        
        console.log('Saving config:', newConfig);
        
        const response = await fetch('/api/config', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(newConfig)
        });
        
        const result = await response.json();
        console.log('Save result:', result);
        
        if (result.success) {
          alert('Settings saved! App will restart now...');
          // Đợi server restart rồi reload trang
          setTimeout(() => {
            window.location.reload();
          }, 2000);
        } else {
          alert('Error saving settings: ' + result.message);
        }
      } catch (e) {
        console.error('Error saving settings:', e);
        alert('Error saving settings: ' + e.message);
      }
    },
    // Power Control Functions
    async powerToggle(duration = 200) {
      try {
        console.log('[Power] Toggle (short press, ' + duration + 'ms)');
        const response = await fetch('/api/power', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'toggle', duration })
        });
        const result = await response.json();
        console.log('[Power] Response:', result);
        if (result.success) {
          alert('Power toggled!');
        } else {
          alert('Power error: ' + result.error);
        }
      } catch (e) {
        console.error('[Power] Error:', e);
        alert('Power error: ' + e.message);
      }
    },
    async powerShutdown(duration = 5000) {
      try {
        if (!confirm('Force shutdown? (Hold ' + (duration/1000) + 's)')) {
          return;
        }
        console.log('[Power] Shutdown (long press, ' + duration + 'ms)');
        const response = await fetch('/api/power', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'shutdown', duration })
        });
        const result = await response.json();
        console.log('[Power] Response:', result);
        if (result.success) {
          alert('Shutdown signal sent!');
        } else {
          alert('Power error: ' + result.error);
        }
      } catch (e) {
        console.error('[Power] Error:', e);
        alert('Power error: ' + e.message);
      }
    }
  },
});
