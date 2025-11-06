#!/usr/bin/env node

const { spawn } = require('child_process');
const { Web3 } = require('web3');
const fs = require('fs');
const path = require('path');

const GANACHE_URL = 'http://127.0.0.1:7545';
const CONTRACT_INFO_PATH = path.join(__dirname, '..', 'data', 'contract-info.json');

// Check if Ganache is running
async function checkGanache() {
  try {
    const web3 = new Web3(GANACHE_URL);
    const isListening = await web3.eth.net.isListening();
    return isListening;
  } catch (error) {
    return false;
  }
}

// Check if contract is deployed
function checkContract() {
  try {
    if (fs.existsSync(CONTRACT_INFO_PATH)) {
      const contractInfo = JSON.parse(fs.readFileSync(CONTRACT_INFO_PATH, 'utf8'));
      return contractInfo && contractInfo.address;
    }
    return false;
  } catch (error) {
    return false;
  }
}

// Deploy contract
async function deployContract() {
  console.log('Deploying contract...');
  return new Promise((resolve, reject) => {
    const deploy = spawn('node', ['deploy.js'], {
      stdio: 'inherit',
      cwd: __dirname,
    });

    deploy.on('close', (code) => {
      if (code === 0) {
        console.log('[OK] Contract deployed successfully\n');
        resolve();
      } else {
        reject(new Error(`Contract deployment failed with code ${code}`));
      }
    });

    deploy.on('error', (error) => {
      reject(error);
    });
  });
}

// Kill any existing server on port 3000
function killExistingServer() {
  return new Promise((resolve) => {
    const { exec } = require('child_process');
    exec('lsof -ti:3000', (error, stdout) => {
      if (stdout && stdout.trim()) {
        const pids = stdout.trim().split('\n');
        console.log('Stopping existing server on port 3000...');
        pids.forEach(pid => {
          try {
            process.kill(parseInt(pid), 'SIGTERM');
          } catch (e) {
            // Process might already be dead
          }
        });
        // Wait a bit for processes to die
        setTimeout(() => {
          // Force kill if still running
          pids.forEach(pid => {
            try {
              process.kill(parseInt(pid), 'SIGKILL');
            } catch (e) {
              // Ignore
            }
          });
          resolve();
        }, 1000);
      } else {
        resolve();
      }
    });
  });
}

// Start server
function startServer() {
  console.log('Starting server...');
  const server = spawn('node', ['../server/server.js'], {
    stdio: 'inherit',
    cwd: __dirname,
  });

  server.on('error', (error) => {
    console.error('[ERROR] Error starting server:', error.message);
    process.exit(1);
  });

  return server;
}

// Main function
async function start() {
  console.log('Starting Blockchain Log System...\n');

  // Check Ganache
  console.log('1. Checking Ganache connection...');
  const ganacheRunning = await checkGanache();
  if (!ganacheRunning) {
    console.error('[ERROR] Ganache is not running!');
    console.error('  Please start Ganache on port 7545 first.');
    console.error('  Then run this script again.');
    process.exit(1);
  }
  console.log('[OK] Ganache is running\n');

  // Check contract
  console.log('2. Checking contract deployment...');
  const contractDeployed = checkContract();
  if (!contractDeployed) {
    console.log('  Contract not found, deploying...');
    try {
      await deployContract();
    } catch (error) {
      console.error('[ERROR] Failed to deploy contract:', error.message);
      process.exit(1);
    }
  } else {
    console.log('[OK] Contract already deployed\n');
  }

  // Kill any existing server
  console.log('3. Checking for existing server...');
  await killExistingServer();
  console.log('[OK] Port 3000 is available\n');

  // Start server
  console.log('4. Starting server...');
  const server = startServer();

  // Handle cleanup
  process.on('SIGINT', () => {
    console.log('\n\nShutting down...');
    server.kill('SIGINT');
    setTimeout(() => {
      process.exit(0);
    }, 1000);
  });

  process.on('SIGTERM', () => {
    console.log('\n\nShutting down...');
    server.kill('SIGTERM');
    setTimeout(() => {
      process.exit(0);
    }, 1000);
  });

  console.log('\n[OK] System started successfully!');
  console.log('Web interface: http://localhost:3000');
  console.log('API endpoint: http://localhost:3000/logs');
  console.log('\nTo stream logs, run: node services/stream-logs.js');
  console.log('Press Ctrl+C to stop the server\n');
}

// Run
start().catch((error) => {
  console.error('[ERROR] Startup failed:', error.message);
  process.exit(1);
});

