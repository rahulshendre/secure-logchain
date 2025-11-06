# Project Structure

```
project/
├── contracts/              # Smart contracts
│   └── SecureLog.sol
├── scripts/               # Deployment and utility scripts
│   ├── deploy.js
│   ├── start.js
│   ├── stop-logs.js
│   ├── connect-ganache.js
│   └── test-api.js
├── server/                # Backend API server
│   └── server.js
├── services/              # Background services
│   └── stream-logs.js
├── public/                # Frontend assets
│   └── index.html
├── data/                  # Generated data files
│   └── contract-info.json
├── docs/                  # Documentation
│   └── TECHNICAL_SUMMARY.md
├── package.json
├── README.md
└── .gitignore
```

## Path Updates

### deploy.js
- SecureLog.sol: `../contracts/SecureLog.sol`
- contract-info.json: `../data/contract-info.json`

### server.js
- contract-info.json: `../data/contract-info.json`
- index.html: `../public/index.html`

### start.js
- contract-info.json: `../data/contract-info.json`
- deploy.js: `deploy.js` (same directory)
- server.js: `../server/server.js`

### package.json
- start: `node scripts/start.js`
- server: `node server/server.js`
- deploy: `node scripts/deploy.js`
- stream: `node services/stream-logs.js`
- stop: `node scripts/stop-logs.js`
