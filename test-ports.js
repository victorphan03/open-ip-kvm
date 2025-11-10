const { SerialPort } = require('serialport');

async function testPorts() {
  console.log('Testing COM ports...\n');
  
  try {
    const ports = await SerialPort.list();
    
    console.log('Available ports detected by SerialPort.list():');
    ports.forEach(port => {
      console.log(`  ${port.path}`);
      console.log(`    Manufacturer: ${port.manufacturer || 'Unknown'}`);
      console.log(`    Product ID: ${port.productId || 'Unknown'}`);
      console.log(`    Vendor ID: ${port.vendorId || 'Unknown'}`);
      console.log('');
    });

    // Try to open each port
    console.log('\nAttempting to open each port:\n');
    for (const port of ports) {
      try {
        const sp = new SerialPort({
          path: port.path,
          baudRate: 115200,
        });
        
        console.log(`✓ SUCCESS: ${port.path} opened successfully`);
        
        // Close gracefully after delay
        await new Promise(resolve => {
          sp.once('open', () => {
            console.log(`  Port opened, waiting for device...`);
            setTimeout(() => {
              sp.close(() => resolve());
            }, 500);
          });
          
          sp.once('error', (err) => {
            console.log(`  Error event: ${err.message} (Code: ${err.code})`);
            resolve();
          });
        });
      } catch (err) {
        console.log(`✗ FAILED: ${port.path}`);
        console.log(`  Error: ${err.message}`);
        console.log(`  Code: ${err.code}`);
      }
    }
  } catch (err) {
    console.error('Error:', err.message);
  }
}

testPorts();
