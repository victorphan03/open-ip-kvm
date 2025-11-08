const { spawn } = require('child_process');
const { SerialPort } = require('serialport');

/**
 * List available serial ports
 */
async function listSerialPorts() {
  try {
    const ports = await SerialPort.list();
    return ports.map(port => ({
      path: port.path,
      manufacturer: port.manufacturer || 'Unknown',
      serialNumber: port.serialNumber || '',
      productId: port.productId || '',
      vendorId: port.vendorId || ''
    }));
  } catch (e) {
    console.error('Error listing serial ports:', e);
    return [];
  }
}

/**
 * List available video devices (Windows only, using ffmpeg)
 */
function listVideoDevices() {
  return new Promise((resolve, reject) => {
    if (process.platform !== 'win32') {
      console.log('[Device Detector] Not Windows, skipping video device detection');
      resolve([]);
      return;
    }

    console.log('[Device Detector] Listing video devices using ffmpeg...');
    const ffmpeg = spawn('ffmpeg', ['-list_devices', 'true', '-f', 'dshow', '-i', 'dummy']);
    let output = '';

    ffmpeg.stderr.on('data', (data) => {
      output += data.toString();
    });

    ffmpeg.on('close', () => {
      console.log('[Device Detector] ffmpeg output length:', output.length);
      const devices = [];
      const lines = output.split('\n');
      let inVideoSection = false;

      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        
        // Detect video devices section
        if (line.includes('DirectShow video devices')) {
          inVideoSection = true;
          console.log('[Device Detector] Found video devices section');
          continue;
        }
        
        // Stop when reaching audio section
        if (line.includes('DirectShow audio devices')) {
          console.log('[Device Detector] Reached audio section, stopping');
          break;
        }

        if (inVideoSection && line.includes('[dshow @')) {
          // Extract device name
          const match = line.match(/"([^"]+)"/);
          if (match && match[1] !== 'dummy') {
            const deviceName = match[1];
            
            // Check if next line has alternative name
            let alternativeName = null;
            if (i + 1 < lines.length && lines[i + 1].includes('Alternative name')) {
              const altMatch = lines[i + 1].match(/"([^"]+)"/);
              if (altMatch) {
                alternativeName = altMatch[1];
              }
            }
            
            console.log('[Device Detector] Found video device:', deviceName);
            devices.push({
              name: deviceName,
              alternativeName: alternativeName
            });
          }
        }
      }

      console.log(`[Device Detector] Total video devices found: ${devices.length}`);
      resolve(devices);
    });

    ffmpeg.on('error', (err) => {
      console.error('[Device Detector] Error running ffmpeg:', err);
      resolve([]);
    });
  });
}

module.exports = {
  listSerialPorts,
  listVideoDevices
};
