// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

contract SecureLog {
    // Structure to store a log entry
    struct LogEntry {
        string message;
        address sender;
        uint256 timestamp;
    }

    // Array to store all log entries
    LogEntry[] public logs;

    // Add a new log entry
    function addLog(string memory message) public {
        logs.push(LogEntry({
            message: message,
            sender: msg.sender,
            timestamp: block.timestamp
        }));
    }

    // Get all stored logs
    function getLogs() public view returns (LogEntry[] memory) {
        return logs;
    }
}

