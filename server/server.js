const express = require('express');
const cors = require('cors');
const { Web3 } = require('web3');
const { HttpProvider } = require('web3-providers-http');
const fs = require('fs');
const path = require('path');

// Load contract information from JSON file
const contractInfoPath = path.join(__dirname, '..', 'data', 'contract-info.json');
let contractInfo;

try {
  contractInfo = JSON.parse(fs.readFileSync(contractInfoPath, 'utf8'));
} catch (error) {
  console.error('[ERROR] Could not load contract-info.json');
  console.error('  Please run deploy.js first to deploy the contract');
  process.exit(1);
}

// Connect to Ganache using HttpProvider
const ganacheUrl = contractInfo.network || 'http://127.0.0.1:7545';
const provider = new HttpProvider(ganacheUrl);
const web3 = new Web3(provider);

// Create Express app
const app = express();
// Enable CORS for all routes
app.use(cors());
app.use(express.json());

// Serve the HTML file
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, '..', 'public', 'index.html'), (err) => {
    if (err) {
      console.error('Error sending file:', err);
      res.status(500).send('Error loading page');
    }
  });
});

// Initialize contract instance
let contract;
let accounts;

// Initialize web3 connection and contract
async function initialize() {
  try {
    // Check connection to Ganache with timeout
    const isConnected = await Promise.race([
      web3.eth.net.isListening(),
      new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Connection timeout')), 5000)
      )
    ]);
    
    if (!isConnected) {
      throw new Error('Failed to connect to Ganache');
    }

    // Get accounts from Ganache
    accounts = await web3.eth.getAccounts();
    if (accounts.length === 0) {
      throw new Error('No accounts available in Ganache');
    }

    // Create contract instance using ABI and address
    contract = new web3.eth.Contract(contractInfo.abi, contractInfo.address);

    console.log('[OK] Connected to Ganache');
    console.log('[OK] Contract loaded at address:', contractInfo.address);
    console.log('[OK] Using account:', accounts[0]);
    console.log('');

  } catch (error) {
    if (error.code === 'ECONNREFUSED' || 
        error.message.includes('timeout') ||
        error.message.includes('ETIMEDOUT') ||
        error.message.includes('connect')) {
      console.error('[ERROR] Connection Error: Could not connect to Ganache');
      console.error('  Make sure Ganache is running at', ganacheUrl);
      console.error('  Start Ganache and restart the server');
    } else {
      console.error('[ERROR] Error initializing:', error.message);
    }
    process.exit(1);
  }
}

// POST /add-log - Add a new log entry to the blockchain
app.post('/add-log', async (req, res) => {
  try {
    // Validate request body
    const { message } = req.body;
    if (!message || typeof message !== 'string') {
      return res.status(400).json({
        error: 'Invalid request',
        message: 'Please provide a "message" field as a string',
      });
    }

    // Estimate gas for the transaction
    const gasEstimate = await contract.methods.addLog(message).estimateGas({
      from: accounts[0],
    });
    
    // Add larger buffer to gas estimate (convert BigInt to string)
    // Increase buffer to prevent out of gas errors
    const gasWithBuffer = (BigInt(gasEstimate) + BigInt(100000)).toString();
    
    // Ensure minimum gas limit for string operations
    const minGas = '200000';
    const finalGas = BigInt(gasWithBuffer) > BigInt(minGas) ? gasWithBuffer : minGas;
    
    // Call addLog() on the contract and wait for confirmation
    const receipt = await contract.methods.addLog(message).send({
      from: accounts[0],
      gas: finalGas,
    });

    // Return transaction hash
    res.json({
      success: true,
      transactionHash: receipt.transactionHash,
      blockNumber: receipt.blockNumber.toString(),
      message: 'Log entry added successfully',
    });

  } catch (error) {
    // Handle blockchain errors
    let errorMessage = error.message;
    let statusCode = 500;
    
    // Check for connection errors
    if (error.message.includes('ETIMEDOUT') || 
        error.message.includes('ECONNREFUSED') || 
        error.message.includes('connect') ||
        error.message.includes('fetch failed')) {
      errorMessage = 'Cannot connect to Ganache. Please make sure Ganache is running on port 7545.';
      statusCode = 503; // Service Unavailable
      console.error('[ERROR] Ganache connection error:', error.message);
    } else {
      console.error('Error adding log:', error.message);
    }
    
    res.status(statusCode).json({
      error: 'Failed to add log',
      message: errorMessage,
    });
  }
});

// GET /logs - Retrieve all logs from the blockchain
// GET /get - Alias for /logs
async function getLogsHandler(req, res) {
  try {
    let totalCount = 0;
    let formattedLogs = [];
    
    // Strategy: Fetch logs individually to avoid gas issues
    // Find the highest index first by binary search, then fetch backwards
    try {
      // Binary search to find the highest valid index
      let highestIndex = -1;
      let low = 0;
      let high = 10000; // Start with a high upper bound
      
      // First, find a valid upper bound by checking high indices
      let upperBound = -1;
      for (let testIndex = 10000; testIndex >= 0; testIndex -= 500) {
        try {
          const testLog = await contract.methods.logs(testIndex).call();
          if (testLog && testLog.message) {
            upperBound = testIndex;
            break;
          }
        } catch (e) {
          // Index doesn't exist, continue
        }
      }
      
      // If we found an upper bound, do binary search to find the exact highest index
      if (upperBound >= 0) {
        low = upperBound;
        high = upperBound + 1000; // Check up to 1000 more indices
        
        // Binary search to find the exact highest index
        while (low <= high) {
          const mid = Math.floor((low + high) / 2);
          try {
            const testLog = await contract.methods.logs(mid).call();
            if (testLog && testLog.message) {
              highestIndex = mid;
              low = mid + 1; // Search higher
            } else {
              high = mid - 1; // Search lower
            }
          } catch (e) {
            // Index doesn't exist, search lower
            high = mid - 1;
          }
        }
      } else {
        // No upper bound found, search from the beginning
        // Try to find the highest index by checking from a reasonable starting point
        for (let i = 0; i < 5000; i++) {
          try {
            const log = await contract.methods.logs(i).call();
            if (log && log.message) {
              highestIndex = i;
            } else {
              break;
            }
          } catch (e) {
            // Index doesn't exist, we've found the end
            break;
          }
        }
      }
      
      // Now fetch the latest 100 logs (from highestIndex backwards)
      const startIndex = Math.max(0, highestIndex - 99);
      const endIndex = highestIndex;
      
      for (let i = endIndex; i >= startIndex && i >= 0; i--) {
        try {
          const log = await contract.methods.logs(i).call();
          if (log && log.message) {
            formattedLogs.push({
              index: i,
              message: log.message,
              sender: log.sender,
              timestamp: log.timestamp.toString(),
            });
          }
        } catch (e) {
          // Index doesn't exist, skip
          continue;
        }
      }
      
      totalCount = highestIndex + 1; // Total count is highestIndex + 1
      
    } catch (error) {
      // Fallback: try getLogs() with higher gas limit
      console.log('Individual fetching failed, trying getLogs()...');
      try {
        const logs = await contract.methods.getLogs().call({
          gas: '8000000' // Very high gas limit
        });
        formattedLogs = logs.map((log, index) => ({
          index: index,
          message: log.message,
          sender: log.sender,
          timestamp: log.timestamp.toString(),
        }));
        totalCount = formattedLogs.length;
        // Reverse to show newest first
        formattedLogs = formattedLogs.reverse();
      } catch (gasError) {
        throw new Error('Failed to retrieve logs: ' + gasError.message);
      }
    }

    // Limit to latest 100 logs to prevent performance issues
    const limitedLogs = formattedLogs.slice(0, 100); // Already newest first

    res.json({
      success: true,
      count: totalCount,
      displayed: limitedLogs.length,
      logs: limitedLogs,
    });

  } catch (error) {
    // Handle blockchain errors
    let errorMessage = error.message;
    let statusCode = 500;
    
    // Check for connection errors
    if (error.message.includes('ETIMEDOUT') || 
        error.message.includes('ECONNREFUSED') || 
        error.message.includes('connect') ||
        error.message.includes('fetch failed')) {
      errorMessage = 'Cannot connect to Ganache. Please make sure Ganache is running on port 7545.';
      statusCode = 503; // Service Unavailable
      console.error('[ERROR] Ganache connection error:', error.message);
    } else {
      console.error('Error retrieving logs:', error.message);
    }
    
    res.status(statusCode).json({
      error: 'Failed to retrieve logs',
      message: errorMessage,
    });
  }
}

app.get('/logs', getLogsHandler);
app.get('/api/logs', getLogsHandler); // API endpoint
app.get('/get', getLogsHandler);

// Health check endpoint
app.get('/health', async (req, res) => {
  try {
    const isConnected = await web3.eth.net.isListening();
    res.json({
      status: 'healthy',
      connected: isConnected,
      contractAddress: contractInfo.address,
    });
  } catch (error) {
    res.status(500).json({
      status: 'unhealthy',
      error: error.message,
    });
  }
});

// Start server
const PORT = 3000;

async function startServer() {
  // Initialize web3 connection first
  await initialize();

  // Start Express server
  const server = app.listen(PORT, () => {
    console.log(`[OK] Server running on http://localhost:${PORT}`);
    console.log('');
    console.log('Available endpoints:');
    console.log('  GET  /         - Web interface');
    console.log('  POST /add-log - Add a log entry');
    console.log('  GET  /logs    - Get all logs (latest 100)');
    console.log('  GET  /get     - Get all logs (alias)');
    console.log('  GET  /health  - Health check');
    console.log('');
  });

  // Handle server errors
  server.on('error', (error) => {
    if (error.code === 'EADDRINUSE') {
      console.error(`[ERROR] Port ${PORT} is already in use`);
      console.error('  Please stop the other server or use a different port');
    } else {
      console.error('[ERROR] Server error:', error.message);
    }
    process.exit(1);
  });

  // Handle connection errors gracefully
  server.on('clientError', (err, socket) => {
    if (!socket.destroyed) {
      socket.end('HTTP/1.1 400 Bad Request\r\n\r\n');
    }
  });

  // Keep server alive
  server.keepAliveTimeout = 65000;
  server.headersTimeout = 66000;
}

startServer().catch((error) => {
  console.error('Failed to start server:', error);
  process.exit(1);
});

