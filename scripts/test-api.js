// Simple test script to add and retrieve logs
const http = require('http');

// Add a log entry
function addLog(message) {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify({ message });
    
    const options = {
      hostname: 'localhost',
      port: 3000,
      path: '/add-log',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': data.length,
      },
    };

    const req = http.request(options, (res) => {
      let body = '';
      res.on('data', (chunk) => {
        body += chunk;
      });
      res.on('end', () => {
        resolve(JSON.parse(body));
      });
    });

    req.on('error', reject);
    req.write(data);
    req.end();
  });
}

// Get all logs
function getLogs() {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'localhost',
      port: 3000,
      path: '/get',
      method: 'GET',
    };

    const req = http.request(options, (res) => {
      let body = '';
      res.on('data', (chunk) => {
        body += chunk;
      });
      res.on('end', () => {
        resolve(JSON.parse(body));
      });
    });

    req.on('error', reject);
    req.end();
  });
}

// Test the API
async function test() {
  try {
    console.log('Adding a log entry...');
    const addResult = await addLog('Test log entry from Node.js');
    console.log('[OK] Log added:', addResult);
    console.log('');

    console.log('Retrieving all logs...');
    const logs = await getLogs();
    console.log('[OK] Logs retrieved:');
    console.log(JSON.stringify(logs, null, 2));
  } catch (error) {
    console.error('Error:', error.message);
  }
}

test();

