const { SerialPort } = require('serialport');

let serialport;

function writeSerial(numArr) {
  if (!serialport) {
    console.warn('Serial port not available, ignoring write request');
    return;
  }
  const buf = Buffer.from(numArr);
  serialport.write(buf);
}

module.exports.startSerial = function(portPath) {
  if (serialport) {
    return writeSerial;
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