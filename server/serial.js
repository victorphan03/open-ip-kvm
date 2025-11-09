const { SerialPort } = require('serialport');

let serialport;

function writeSerial(numArr) {
  const buf = Buffer.from(numArr);
  serialport.write(buf);
}

module.exports.startSerial = function(portPath) {
  if (serialport) {
    return;
  }

  serialport = new SerialPort({
    path: portPath,
    baudRate: 115200,
  });

  console.log(`serialport ready: ${portPath}`);

  return writeSerial;
}