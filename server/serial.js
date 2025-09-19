const { SerialPort } = require('serialport');

let serialport;
let onLedStatusCallback;

function writeSerial(numArr) {
  const buf = Buffer.from(numArr);
  serialport.write(buf);
}

// Power control functions
function sendPowerButton() {
  writeSerial([252, 1, 251]); // POWER_EVT_START, POWER_EVT_TYPE_POWER_BUTTON, EVT_END
}

function sendResetButton() {
  writeSerial([252, 2, 251]); // POWER_EVT_START, POWER_EVT_TYPE_RESET_BUTTON, EVT_END
}

function requestLedStatus() {
  writeSerial([252, 3, 251]); // POWER_EVT_START, POWER_EVT_TYPE_READ_STATUS, EVT_END
}

// Parse incoming LED status messages
function parseSerialData(data) {
  const buffer = Array.from(data);
  
  // Look for LED status messages: [253, type, status, 251]
  for (let i = 0; i < buffer.length - 3; i++) {
    if (buffer[i] === 253 && buffer[i + 3] === 251) {
      const ledType = buffer[i + 1]; // 1 = power LED, 2 = HDD LED
      const ledStatus = buffer[i + 2]; // 0 = off, 1 = on
      
      if (onLedStatusCallback) {
        onLedStatusCallback({
          type: ledType === 1 ? 'power' : 'hdd',
          status: ledStatus === 1
        });
      }
    }
  }
}

module.exports.startSerial = function(portPath, ledStatusCallback) {
  if (serialport) {
    return;
  }

  onLedStatusCallback = ledStatusCallback;

  serialport = new SerialPort({
    path: portPath,
    baudRate: 19200,
  });

  // Listen for incoming data to parse LED status
  serialport.on('data', parseSerialData);

  console.log(`serialport ready: ${portPath}`);

  return {
    writeSerial,
    sendPowerButton,
    sendResetButton,
    requestLedStatus
  };
}