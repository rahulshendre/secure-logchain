const { spawn } = require('child_process');

// Backend API endpoint for adding logs
const API_URL = 'http://localhost:3000/add-log';

// Buffer to accumulate log data until we have complete lines
let logBuffer = '';

// Track server availability to reduce error spam
let serverAvailable = true;
let lastErrorTime = 0;
const ERROR_THROTTLE_MS = 5000; // Only show error every 5 seconds

// Rate limiting: only send logs every N milliseconds to prevent overload
let lastSentTime = 0;
const SEND_INTERVAL_MS = 1000; // Send at most 1 log per second (reduced to prevent Ganache crash)
let logQueue = [];
const MAX_QUEUE_SIZE = 50; // Limit queue size to prevent memory issues

// Global flag to stop sending logs
let isStopped = false;

// Daily limit to prevent Ganache from crashing
let dailyLogCount = 0;
let dailyResetTime = Date.now() + (24 * 60 * 60 * 1000); // 24 hours from now
const MAX_LOGS_PER_DAY = 1000; // Maximum logs per day

// Queue log for sending with rate limiting
function queueLogForSending(message) {
  if (isStopped) {
    return; // Don't queue if stopped
  }
  
  // Limit queue size to prevent memory issues
  if (logQueue.length >= MAX_QUEUE_SIZE) {
    // Remove oldest log from queue
    logQueue.shift();
  }
  
  logQueue.push(message);
  processLogQueue();
}

// Process log queue with rate limiting
async function processLogQueue() {
  const now = Date.now();
  if (now - lastSentTime < SEND_INTERVAL_MS) {
    // Too soon, schedule next check
    setTimeout(processLogQueue, SEND_INTERVAL_MS - (now - lastSentTime));
    return;
  }

  if (logQueue.length > 0) {
    const message = logQueue.shift();
    lastSentTime = Date.now();
    // Send to blockchain via API (don't await to avoid blocking)
    sendLogToBlockchain(message).catch(() => {
      // Errors are already handled in sendLogToBlockchain
    });
    
    // Process next item in queue
    if (logQueue.length > 0) {
      setTimeout(processLogQueue, SEND_INTERVAL_MS);
    }
  }
}

// Send log entry to blockchain via backend API
async function sendLogToBlockchain(message) {
  // Don't send if stopped
  if (isStopped) {
    return false;
  }
  
  // Check daily limit
  const now = Date.now();
  if (now >= dailyResetTime) {
    // Reset daily counter
    dailyLogCount = 0;
    dailyResetTime = now + (24 * 60 * 60 * 1000); // Next 24 hours
  }
  
  // Enforce daily limit
  if (dailyLogCount >= MAX_LOGS_PER_DAY) {
    // Only show message once per hour to avoid spam
    const hoursSinceReset = Math.floor((now - (dailyResetTime - 24 * 60 * 60 * 1000)) / (60 * 60 * 1000));
    if (hoursSinceReset % 1 === 0) {
      console.error('[ERROR] Daily log limit reached (1000 logs/day). Logs will resume tomorrow.');
    }
    return false;
  }
  
  try {
    // Skip empty or whitespace-only messages
    if (!message || !message.trim()) {
      return;
    }

    // Make HTTP POST request to backend API
    const response = await fetch(API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ message: message.trim() }),
    });

    if (response.ok) {
      const result = await response.json();
      // Increment daily counter
      dailyLogCount++;
      // Only show confirmation if server was previously unavailable
      if (!serverAvailable) {
        console.log('[OK] Server reconnected - logs are being sent to blockchain');
        serverAvailable = true;
      }
      return true;
    } else {
      const error = await response.json();
      // Throttle error messages
      const now = Date.now();
      if (now - lastErrorTime > ERROR_THROTTLE_MS) {
        console.error(`[ERROR] API error: ${error.message || 'Unknown error'}`);
        lastErrorTime = now;
      }
      return false;
    }
  } catch (error) {
    // Handle network errors gracefully
    if (error.code === 'ECONNREFUSED' || error.message.includes('fetch failed')) {
      // Only show error message occasionally to avoid spam
      const now = Date.now();
      if (serverAvailable || (now - lastErrorTime > ERROR_THROTTLE_MS)) {
        console.error('[ERROR] Server not available - logs will be skipped until server is back online');
        serverAvailable = false;
        lastErrorTime = now;
      }
    } else {
      console.error(`[ERROR] Network error: ${error.message}`);
    }
    return false;
  }
}

// Spawn the macOS log stream command
// This creates a child process that runs 'log stream' which continuously outputs system logs
const logStream = spawn('log', ['stream']);

// Handle stdout: process each line of log output in real-time
// The 'data' event fires whenever new log data is available
logStream.stdout.on('data', (data) => {
  // Convert buffer to string and add to log buffer
  logBuffer += data.toString();
  
  // Process complete lines (split by newline)
  const lines = logBuffer.split('\n');
  // Keep the last incomplete line in the buffer
  logBuffer = lines.pop() || '';
  
  // Process each complete line with rate limiting
  for (const line of lines) {
    if (line.trim()) {
      // Print the log line to console
      console.log(line);
      // Queue log for sending (rate limited)
      queueLogForSending(line);
    }
  }
});

// Handle stderr: print any error messages from the log command
// This helps debug issues with the log stream command itself
logStream.stderr.on('data', (data) => {
  // Write error output to stderr
  process.stderr.write(data);
});

// Handle process errors: catch any errors that occur when spawning the process
// This handles cases like 'log' command not found or permission issues
logStream.on('error', (error) => {
  console.error('Error spawning log stream:', error.message);
  process.exit(1);
});

// Handle process exit: clean up when the log stream process ends
// This ensures the script exits gracefully when the child process terminates
logStream.on('exit', (code, signal) => {
  if (signal) {
    console.error(`\nLog stream process was killed by signal: ${signal}`);
  } else if (code !== 0) {
    console.error(`\nLog stream process exited with code: ${code}`);
  } else {
    console.log('\nLog stream process ended normally');
  }
  process.exit(code || 0);
});

// Handle Ctrl+C (SIGINT): allow user to gracefully stop the script
// This ensures both the child process and parent process exit cleanly
process.on('SIGINT', () => {
  console.log('\n\nStopping log stream...');
  isStopped = true; // Stop sending logs
  logQueue = []; // Clear queue
  // Kill the child process
  if (logStream && !logStream.killed) {
    logStream.kill('SIGINT');
  }
  // Exit the parent process after a short delay
  setTimeout(() => {
    process.exit(0);
  }, 500);
});

// Handle SIGTERM: similar to SIGINT but for termination signals
process.on('SIGTERM', () => {
  console.log('\n\nTerminating log stream...');
  isStopped = true; // Stop sending logs
  logQueue = []; // Clear queue
  if (logStream && !logStream.killed) {
    logStream.kill('SIGTERM');
  }
  setTimeout(() => {
    process.exit(0);
  }, 500);
});

console.log('Starting macOS system log stream...');
console.log('Logs will be automatically sent to blockchain via API');
console.log('API endpoint:', API_URL);
console.log('Press Ctrl+C to stop\n');

