#!/usr/bin/env node

// Stop all log streaming processes
console.log('Stopping log streaming...\n');

// Kill all stream-logs.js processes
const { exec } = require('child_process');

exec('pkill -f "stream-logs.js"', (error, stdout, stderr) => {
  if (error && error.code !== 1) {
    // pkill returns code 1 if no processes found, which is fine
    console.log('[OK] No log streaming processes found');
  } else {
    console.log('[OK] Stopped log streaming processes');
  }
  
  // Also kill any log stream child processes
  exec('pkill -f "log stream"', (error2, stdout2, stderr2) => {
    if (error2 && error2.code !== 1) {
      console.log('[OK] No log stream processes found');
    } else {
      console.log('[OK] Stopped log stream processes');
    }
    
    // Verify everything is stopped
    setTimeout(() => {
      exec('ps aux | grep -E "stream-logs|log stream" | grep -v grep', (error3, stdout3) => {
        if (stdout3 && stdout3.trim()) {
          console.log('\n[WARNING] Some processes may still be running:');
          console.log(stdout3);
        } else {
          console.log('\n[OK] All log streaming stopped successfully!');
          console.log('   No logs will be registered on Ganache.\n');
        }
      });
    }, 1000);
  });
});

