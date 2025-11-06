# Technical Summary: Blockchain-Based Secure Log Storage System

## Project Overview

This project implements a decentralized log storage system that captures macOS system logs in real-time and stores them immutably on a blockchain (Ganache). The system consists of a Solidity smart contract, Node.js backend API, real-time log streaming service, and a web-based user interface.

---

## Architecture Components

### 1. Smart Contract Layer (`SecureLog.sol`)

**Technology:** Solidity 0.8.0  
**Purpose:** Immutable log storage on blockchain

**Key Features:**
- **Data Structure:** `LogEntry` struct containing:
  - `message` (string): The log content
  - `sender` (address): Ethereum address that added the log
  - `timestamp` (uint256): Unix timestamp from block
- **Storage:** Dynamic array `LogEntry[] public logs`
- **Functions:**
  - `addLog(string memory message)`: Adds a new log entry (nonpayable, writes to blockchain)
  - `getLogs()`: Returns all logs (view function, read-only)
  - `logs(uint256)`: Public array accessor for individual log retrieval

**Technical Details:**
- Uses `block.timestamp` for automatic timestamping
- Uses `msg.sender` for automatic sender address capture
- EVM version: London (compatible with Ganache)

---

### 2. Contract Deployment (`deploy.js`)

**Technology:** Node.js, Web3.js v4, Solidity Compiler (solc)  
**Purpose:** Compile and deploy smart contract to Ganache

**Key Functionality:**
- **Compilation:**
  - Reads `SecureLog.sol` source code
  - Compiles using `solc` with EVM version 'london'
  - Extracts ABI and bytecode
  - Validates compilation output
- **Deployment:**
  - Connects to Ganache at `http://127.0.0.1:7545`
  - Uses first account as deployer
  - Estimates gas with 100,000 buffer
  - Deploys contract and receives address
- **Persistence:**
  - Saves contract ABI, address, and network to `contract-info.json`
  - Enables backend to load contract without redeployment

**Error Handling:**
- Connection failures (ECONNREFUSED)
- Compilation errors
- Deployment failures
- Empty bytecode validation

---

### 3. Backend API Server (`server.js`)

**Technology:** Express.js, Web3.js v4, CORS  
**Purpose:** RESTful API bridge between frontend and blockchain

**Architecture:**
- **Initialization:**
  - Loads contract info from `contract-info.json`
  - Connects to Ganache using `HttpProvider`
  - Creates contract instance with ABI and address
  - Validates connection with 5-second timeout
  - Retrieves accounts for transaction signing

**API Endpoints:**

1. **`GET /`** - Web Interface
   - Serves `index.html` static file
   - Enables direct browser access

2. **`POST /add-log`** - Add Log Entry
   - **Request Body:** `{ message: string }`
   - **Process:**
     - Validates message string
     - Estimates gas for transaction
     - Adds 100,000 gas buffer
     - Enforces minimum 200,000 gas limit
     - Calls `contract.methods.addLog(message).send()`
     - Waits for transaction confirmation
   - **Response:**
     ```json
     {
       "success": true,
       "transactionHash": "0x...",
       "blockNumber": "6789",
       "message": "Log entry added successfully"
     }
     ```
   - **Error Handling:**
     - Connection errors (503 Service Unavailable)
     - Invalid requests (400 Bad Request)
     - Gas estimation failures

3. **`GET /logs`** - Retrieve Logs (Latest 100)
   - **Algorithm:** Binary search for highest index
     - Checks indices from 10,000 down by 500
     - Finds upper bound of existing logs
     - Performs binary search to find exact highest index
     - Falls back to sequential search if needed
   - **Fetching:**
     - Retrieves latest 100 logs individually (avoids gas issues)
     - Fetches from `highestIndex` backwards
     - Uses `contract.methods.logs(index).call()` for each log
   - **Fallback:**
     - If individual fetching fails, attempts `getLogs()` with 8M gas limit
   - **Response:**
     ```json
     {
       "success": true,
       "count": 3164,
       "displayed": 100,
       "logs": [
         {
           "index": 3163,
           "message": "...",
           "sender": "0x...",
           "timestamp": "1762431331"
         }
       ]
     }
     ```

4. **`GET /api/logs`** - Alias for `/logs`
5. **`GET /get`** - Alias for `/logs`
6. **`GET /health`** - Health Check
   - Returns connection status and contract address

**Server Configuration:**
- Port: 3000
- CORS: Enabled for all routes
- Keep-alive timeout: 65 seconds
- Headers timeout: 66 seconds
- Error handling for EADDRINUSE, client errors

---

### 4. Log Streaming Service (`stream-logs.js`)

**Technology:** Node.js `child_process.spawn`, native `fetch` API  
**Purpose:** Real-time macOS system log capture and blockchain storage

**Architecture:**

**Log Capture:**
- Spawns `log stream` command as child process
- Processes stdout in real-time using event-driven I/O
- Buffers incomplete lines until newline received
- Handles stderr for command errors

**Rate Limiting & Queue Management:**
- **Send Interval:** 1 log per second (1000ms)
- **Queue Size:** Maximum 50 logs in memory
- **Queue Processing:**
  - Asynchronous queue processing
  - Prevents overwhelming Ganache
  - Drops oldest logs if queue exceeds limit
- **Daily Limit:** 1,000 logs per day
  - Resets every 24 hours
  - Prevents Ganache from crashing under load

**HTTP Integration:**
- Sends logs to `http://localhost:3000/add-log` via POST
- Uses native `fetch` API (Node.js 18+)
- **Error Handling:**
  - Throttles error messages (5-second intervals)
  - Tracks server availability state
  - Gracefully handles ECONNREFUSED, network failures
  - Skips empty/whitespace-only messages

**Process Management:**
- Handles SIGINT (Ctrl+C) gracefully
- Handles SIGTERM for clean shutdown
- Sets `isStopped` flag to prevent new log sending
- Clears queue on shutdown
- Kills child process on exit

---

### 5. Web User Interface (`index.html`)

**Technology:** Vanilla JavaScript, HTML5, CSS3  
**Purpose:** Interactive log viewing and management

**Features:**

**Automatic Refresh:**
- Fetches logs every 5 seconds
- Rate limiting: Maximum 20 API calls per minute
- Incremental updates: Only appends new logs
- Tracks `lastLogIndex` to avoid duplicates

**Smooth Display:**
- Queues logs for smooth rendering
- Displays 2 logs per second (500ms interval)
- Prevents UI blocking during large updates

**Log Display:**
- Shows latest 100 logs in table format
- Columns: Index, Timestamp, Sender, Message
- Extracts original timestamp from log message if available
- Falls back to blockchain timestamp
- Limits visible logs to 100 (removes oldest from DOM)

**Manual Operations:**
- **Add Log:** POST request to `/add-log`
- **Refresh:** Full reload of logs
- Real-time feedback with success/error messages

**API Integration:**
- Uses `/api/logs` endpoint
- Handles connection errors gracefully
- Displays loading states

---

### 6. Orchestration Script (`start.js`)

**Technology:** Node.js, `child_process.spawn`, `lsof`  
**Purpose:** Automated system startup and initialization

**Startup Sequence:**

1. **Ganache Check:**
   - Verifies Ganache is running on port 7545
   - Uses Web3.js to test connection
   - Exits if not available

2. **Contract Deployment Check:**
   - Checks for `contract-info.json`
   - If missing, runs `deploy.js` automatically
   - Waits for deployment completion

3. **Port Cleanup:**
   - Uses `lsof` to find processes on port 3000
   - Sends SIGTERM to existing processes
   - Force kills with SIGKILL after 1 second
   - Ensures clean server startup

4. **Server Startup:**
   - Spawns `server.js` as child process
   - Inherits stdio for real-time output
   - Handles SIGINT/SIGTERM for graceful shutdown

**Error Handling:**
- Validates each step before proceeding
- Provides clear error messages
- Exits with appropriate codes

---

### 7. Log Streaming Control (`stop-logs.js`)

**Technology:** Node.js, `pkill` command  
**Purpose:** Gracefully stop all log streaming processes

**Functionality:**
- Kills all `stream-logs.js` processes using `pkill`
- Kills all `log stream` child processes
- Verifies processes are stopped
- Provides confirmation messages

---

### 8. Utility Scripts

**`connect-ganache.js`:**
- Simple connection test to Ganache
- Lists all accounts and balances
- Useful for debugging blockchain connectivity

**`test-api.js`:**
- Manual API testing script
- Tests `POST /add-log` and `GET /get` endpoints
- Uses native `http` module

**`contract-info.json`:**
- Generated after contract deployment
- Contains:
  - Contract ABI (Application Binary Interface)
  - Contract address (deployed instance)
  - Network URL (Ganache endpoint)
- Used by `server.js` for contract initialization

---

## Current System Flow

### 1. Initialization Flow

```
User runs: npm start
    ↓
start.js executes
    ↓
[1] Check Ganache connection (port 7545)
    ↓
[2] Check contract-info.json exists
    ├─ Yes → Skip deployment
    └─ No → Run deploy.js
        ↓
        Compile SecureLog.sol
        ↓
        Deploy to Ganache
        ↓
        Save contract-info.json
    ↓
[3] Kill existing server on port 3000
    ↓
[4] Start server.js
    ↓
    Load contract-info.json
    ↓
    Connect to Ganache
    ↓
    Initialize contract instance
    ↓
    Start Express server on port 3000
    ↓
✅ System ready
```

### 2. Log Streaming Flow

```
User runs: node stream-logs.js
    ↓
Spawn 'log stream' child process
    ↓
[Real-time] macOS system logs arrive
    ↓
Process stdout line by line
    ↓
Queue log message (rate limiting: 1/second)
    ↓
Check daily limit (1000 logs/day)
    ↓
HTTP POST to http://localhost:3000/add-log
    ↓
server.js receives request
    ↓
Estimate gas for addLog() transaction
    ↓
Send transaction to Ganache
    ↓
Wait for block confirmation
    ↓
Return transaction hash to stream-logs.js
    ↓
✅ Log stored on blockchain
```

### 3. Web UI Flow

```
User opens: http://localhost:3000
    ↓
Browser loads index.html
    ↓
JavaScript initializes
    ↓
[Every 5 seconds] Fetch GET /api/logs
    ↓
server.js processes request
    ↓
Binary search for highest log index
    ↓
Fetch latest 100 logs individually
    ↓
Return JSON response
    ↓
Frontend filters new logs (index > lastLogIndex)
    ↓
Queue logs for smooth display (2/second)
    ↓
Append to table (newest first)
    ↓
✅ User sees latest logs
```

### 4. Manual Log Addition Flow

```
User types message in web UI
    ↓
Click "Add Log" button
    ↓
JavaScript POST to /add-log
    ↓
server.js validates request
    ↓
Estimate gas and send transaction
    ↓
Wait for confirmation
    ↓
Return success response
    ↓
Frontend refreshes logs
    ↓
✅ New log appears in table
```

---

## Technical Specifications

### Dependencies

**Production:**
- `express@^5.1.0`: Web server framework
- `web3@^4.16.0`: Ethereum JavaScript API
- `cors@^2.8.5`: Cross-origin resource sharing

**Development:**
- `solc@^0.8.30`: Solidity compiler

### Network Configuration

- **Ganache:** `http://127.0.0.1:7545`
- **Backend API:** `http://localhost:3000`
- **Web Interface:** `http://localhost:3000`

### Gas Management

- **Deployment:** Estimated gas + 100,000 buffer
- **Add Log:** Estimated gas + 100,000 buffer, minimum 200,000
- **Get Logs:** Individual calls (no gas for view functions)
- **Fallback Get Logs:** 8,000,000 gas limit

### Performance Optimizations

1. **Rate Limiting:**
   - Log streaming: 1 log/second
   - Daily limit: 1,000 logs/day
   - Queue size: 50 logs maximum

2. **Log Retrieval:**
   - Binary search for efficient index finding
   - Individual log fetching (avoids gas issues)
   - Limits display to latest 100 logs

3. **Frontend:**
   - Incremental updates (only new logs)
   - Smooth rendering (2 logs/second)
   - Rate-limited API calls (20/minute)

### Error Handling

- **Connection Errors:** Graceful degradation with retry logic
- **Gas Errors:** Dynamic gas estimation with buffers
- **Network Errors:** Throttled error messages
- **Process Errors:** Clean shutdown on SIGINT/SIGTERM

---

## File Structure

```
Project/
├── SecureLog.sol              # Smart contract source
├── deploy.js                  # Contract compilation & deployment
├── server.js                  # Express backend API
├── stream-logs.js            # Real-time log streaming service
├── start.js                  # System orchestration script
├── stop-logs.js              # Log streaming control
├── connect-ganache.js        # Ganache connection test
├── test-api.js               # API testing utility
├── index.html                # Web user interface
├── contract-info.json        # Generated contract metadata
├── package.json              # Node.js dependencies
└── TECHNICAL_SUMMARY.md      # This document
```

---

## Usage Commands

```bash
# Start entire system (Ganache must be running)
npm start

# Start server only
npm run server

# Deploy contract only
npm run deploy

# Stream logs (requires server to be running)
npm run stream

# Stop log streaming
npm run stop-logs
```

---

## Current Status

- **Total Logs Stored:** 3,164+ logs
- **Latest Log Index:** 3,163
- **System Status:** Fully operational
- **Web UI:** Displaying latest 100 logs
- **Log Streaming:** Active (1 log/second, 1000/day limit)
- **Blockchain:** Ganache local network
- **Contract Address:** `0xb68537dEe96177957E3Ff9C38618eCf3229BBbe2`

---

## Future Enhancements

1. **Pagination:** Support for retrieving logs by page/range
2. **Filtering:** Search logs by sender, timestamp, or message content
3. **Compression:** Reduce gas costs by compressing log messages
4. **Batch Operations:** Add multiple logs in single transaction
5. **Event Logging:** Use Solidity events for more efficient log retrieval
6. **Authentication:** Add API key or user authentication
7. **Log Rotation:** Automatic cleanup of old logs
8. **Multi-chain Support:** Deploy to testnets or mainnet

---

*Last Updated: 2025-11-06*
*System Version: 1.0.0*

