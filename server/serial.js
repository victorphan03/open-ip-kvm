const { SerialPort } = require('serialport');
const os = require('os');

let serialport;

function writeSerial(numArr) {
  if (!serialport) {
    console.warn('Serial port not available, ignoring write request');
    return;
  }
  const buf = Buffer.from(numArr);
  serialport.write(buf);
}

async function findSerialPortByHardwareId(hardwareId) {
  const { SerialPort } = require('serialport');
  const ports = await SerialPort.list();
  
  // Trên Windows, tìm theo VID/PID từ hardwareId
  if (os.platform() === 'win32') {
    // Extract VID và PID từ hardwareId (ví dụ: "USB\VID_1A86&PID_7523\...")
    const vidMatch = hardwareId.match(/VID_([0-9A-F]{4})/i);
    const pidMatch = hardwareId.match(/PID_([0-9A-F]{4})/i);
    
    if (vidMatch && pidMatch) {
      const vid = vidMatch[1].toLowerCase();
      const pid = pidMatch[1].toLowerCase();
      
      for (const port of ports) {
        if (port.vendorId && port.productId) {
          if (port.vendorId.toLowerCase() === vid && port.productId.toLowerCase() === pid) {
            console.log(`Found serial port by hardware ID: ${port.path} (VID=${vid}, PID=${pid})`);
            return port.path;
          }
        }
      }
      console.warn(`No serial port found matching VID=${vid}, PID=${pid}`);
    }
  }
  
  return null;
}

module.exports.startSerial = async function(portPathOrHardwareId) {
  if (serialport) {
    return writeSerial;
  }

  let portPath = portPathOrHardwareId;
  
  // Trên Windows, nếu config chứa VID/PID thì tự động tìm port
  if (os.platform() === 'win32' && portPathOrHardwareId && portPathOrHardwareId.includes('VID_')) {
    const foundPath = await findSerialPortByHardwareId(portPathOrHardwareId);
    if (foundPath) {
      portPath = foundPath;
    } else {
      console.error('Cannot find serial port with hardware ID:', portPathOrHardwareId);
      return writeSerial;
    }
  }

  try {
    serialport = new SerialPort({
      path: portPath,
      baudRate: 115200,
    });

    console.log(`serialport ready: ${portPath}`);
  } catch (err) {
    console.error(`Failed to open serial port ${portPath}:`, err.message);
    console.log('Serial port will be disabled. You can update it in config.');
  }

  return writeSerial;
}