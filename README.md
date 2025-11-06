# Blockchain-Based Secure Log Storage System

A decentralized log storage system that captures macOS system logs in real-time and stores them immutably on a blockchain using Ganache.

## Table of Contents

- [Overview](#overview)
- [Project Structure](#project-structure)
- [Prerequisites](#prerequisites)
- [Installation](#installation)
- [Usage](#usage)
- [API Endpoints](#api-endpoints)
- [Architecture](#architecture)
- [Technical Details](#technical-details)

## Overview

This project implements a blockchain-based log storage system that:

- **Captures** macOS system logs in real-time
- **Stores** logs immutably on a blockchain (Ganache)
- **Provides** a RESTful API for log management
- **Offers** a web-based interface for viewing logs
- **Ensures** data integrity through blockchain immutability

## Project Structure

```
project/
├── contracts/          # Smart contracts
│   └── SecureLog.sol   # Solidity contract for log storage
├── scripts/            # Deployment and utility scripts
│   ├── deploy.js       # Contract compilation & deployment
│   ├── start.js        # System orchestration script
│   ├── stop-logs.js    # Stop log streaming service
│   ├── connect-ganache.js  # Ganache connection test
│   └── test-api.js     # API testing utility
├── server/             # Backend API server
│   └── server.js       # Express.js REST API
├── services/           # Background services
│   └── stream-logs.js  # Real-time log streaming service
├── public/             # Frontend assets
│   └── index.html      # Web user interface
├── data/               # Generated data files
│   └── contract-info.json  # Contract ABI and address
├── docs/               # Documentation
│   └── TECHNICAL_SUMMARY.md  # Technical documentation
├── package.json        # Node.js dependencies
└── README.md          # This file
```

## Prerequisites

- **Node.js** (v18 or higher)
- **npm** (Node Package Manager)
- **Ganache** (local blockchain) - [Download](https://trufflesuite.com/ganache/)
- **macOS** (for system log streaming)

## Installation

1. **Clone or navigate to the project directory:**
   ```bash
   cd /path/to/project
   ```

2. **Install dependencies:**
   ```bash
   npm install
   ```

3. **Start Ganache:**
   - Open Ganache application
   - Ensure it's running on port `7545`
   - Keep it running while using the system

## Usage

### Quick Start

Start the entire system with one command:

```bash
npm start
```

This will:
1. Check Ganache connection
2. Deploy the contract (if not already deployed)
3. Start the Express server on port 3000

### Individual Commands

**Start the server only:**
```bash
npm run server
```

**Deploy the contract only:**
```bash
npm run deploy
```

**Start log streaming:**
```bash
npm run stream
```

**Stop log streaming:**
```bash
npm run stop-logs
```

### Access the Web Interface

Open your browser and navigate to:
```
http://localhost:3000
```

## API Endpoints

### `GET /`
Returns the web interface (HTML page)

### `POST /add-log`
Add a new log entry to the blockchain

**Request Body:**
```json
{
  "message": "Your log message here"
}
```

**Response:**
```json
{
  "success": true,
  "transactionHash": "0x...",
  "blockNumber": "6789",
  "message": "Log entry added successfully"
}
```

### `GET /logs` or `GET /api/logs`
Retrieve the latest 100 logs from the blockchain

**Response:**
```json
{
  "success": true,
  "count": 3164,
  "displayed": 100,
  "logs": [
    {
      "index": 3163,
      "message": "Log message",
      "sender": "0x...",
      "timestamp": "1762431331"
    }
  ]
}
```

### `GET /health`
Health check endpoint

**Response:**
```json
{
  "status": "healthy",
  "connected": true,
  "contractAddress": "0x..."
}
```

## Architecture

### Components

1. **Smart Contract** (`SecureLog.sol`)
   - Stores log entries in a dynamic array
   - Provides `addLog()` and `getLogs()` functions
   - Uses Solidity 0.8.0

2. **Backend API** (`server/server.js`)
   - Express.js REST API
   - Connects to Ganache via Web3.js
   - Handles log addition and retrieval
   - Serves web interface

3. **Log Streaming Service** (`services/stream-logs.js`)
   - Captures macOS system logs in real-time
   - Sends logs to API with rate limiting (1 log/second)
   - Daily limit: 1,000 logs/day

4. **Web Interface** (`public/index.html`)
   - Displays logs in a table format
   - Auto-refreshes every 5 seconds
   - Allows manual log addition

### Data Flow

```
macOS System Logs
    ↓
stream-logs.js (captures logs)
    ↓
HTTP POST to /add-log
    ↓
server.js (processes request)
    ↓
Smart Contract on Ganache
    ↓
Blockchain Storage (immutable)
```

## Technical Details

### Gas Management

- **Deployment:** Estimated gas + 100,000 buffer
- **Add Log:** Estimated gas + 100,000 buffer, minimum 200,000
- **Get Logs:** Individual calls (no gas for view functions)

### Rate Limiting

- **Log Streaming:** 1 log per second
- **Daily Limit:** 1,000 logs per day
- **Queue Size:** Maximum 50 logs in memory

### Performance Optimizations

- Binary search for efficient log index finding
- Individual log fetching to avoid gas issues
- Latest 100 logs displayed in web UI
- Incremental updates (only new logs)

### Network Configuration

- **Ganache:** `http://127.0.0.1:7545`
- **Backend API:** `http://localhost:3000`
- **Web Interface:** `http://localhost:3000`

## Documentation

For detailed technical documentation, see:
- [TECHNICAL_SUMMARY.md](docs/TECHNICAL_SUMMARY.md)

## Troubleshooting

### "Cannot connect to Ganache"
- Ensure Ganache is running on port 7545
- Check Ganache is not blocked by firewall

### "Port 3000 is already in use"
- The `start.js` script automatically kills existing processes
- Manually kill with: `lsof -ti:3000 | xargs kill -9`

### "Out of gas" errors
- The system automatically estimates gas with buffers
- If issues persist, check Ganache has sufficient balance

### Logs not appearing
- Ensure log streaming is running: `npm run stream`
- Check server is running: `npm run server`
- Verify Ganache is processing transactions

## License

MIT License

## Contributing

This is a project for educational purposes. Feel free to fork and modify as needed.

---

**Last Updated:** 2025-11-06  
**Version:** 1.0.0

