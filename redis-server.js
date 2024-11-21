const net = require('net');
const fs = require('fs');
const path = require('path');

// File for persistence
const PERSISTENCE_FILE = path.join(__dirname, 'data-store.json');

// Load data from disk
let dataStore = {};
if (fs.existsSync(PERSISTENCE_FILE)) {
    try {
        dataStore = JSON.parse(fs.readFileSync(PERSISTENCE_FILE, 'utf8'));
        console.log("Data loaded from disk.");
    } catch (err) {
        console.error("Failed to load data from disk:", err.message);
    }
}

// Save data to disk
function saveData() {
    try {
        fs.writeFileSync(PERSISTENCE_FILE, JSON.stringify(dataStore)); // Use sync version to ensure data is saved
    } catch (err) {
        console.error("Failed to save data:", err.message);
    }
}

// RESP Encoding Functions
function encodeRespString(value) {
    return `+${value}\r\n`;
}

function encodeRespError(value) {
    return `-${value}\r\n`;
}

function encodeRespInteger(value) {
    return `:${value}\r\n`;
}

function encodeRespBulkString(value) {
    if (value === null || value === undefined) {
        return "$-1\r\n"; // Null Bulk String
    }
    return `$${value.length}\r\n${value}\r\n`;
}

function encodeRespArray(values) {
    if (!values || !values.length) { // Added null check
        return "*0\r\n";
    }
    let response = `*${values.length}\r\n`;
    for (const value of values) {
        response += encodeRespBulkString(value);
    }
    return response;
}

// RESP Command Parser
function parseRespCommand(data) {
    try {
        const lines = data.toString().trim().split("\r\n").filter(Boolean);
        if (lines[0].startsWith("*")) {
            const numArgs = parseInt(lines[0].substring(1), 10);
            if (isNaN(numArgs) || numArgs <= 0) {
                return null;
            }
            const args = [];
            for (let i = 2; i < lines.length; i += 2) { // Skip length indicators
                args.push(lines[i]);
            }
            return args;
        }
        return lines[0].split(" "); // Simple command format
    } catch (err) {
        console.error("Parse error:", err.message);
        return null;
    }
}

// Command Handler
function handleCommand(command) {
    if (!Array.isArray(command) || command.length === 0) {
        return encodeRespError("Invalid command format");
    }

    const [cmd, ...args] = command;
    const upperCmd = cmd.toUpperCase();
    console.log("Executing command:", upperCmd);

    if (upperCmd === "SET" && args.length === 2) {
        const [key, value] = args;
        if (!key) {
            return encodeRespError("Key cannot be empty");
        }
        dataStore[key] = value;
        saveData(); // Persist data
        return encodeRespString("OK");
    } else if (upperCmd === "GET" && args.length === 1) {
        const [key] = args;
        const value = dataStore[key];
        return encodeRespBulkString(value);
    } else if (upperCmd === "DEL" && args.length >= 1) {
        let count = 0;
        args.forEach((key) => {
            if (key in dataStore) {
                delete dataStore[key];
                count++;
            }
        });
        saveData(); // Persist data
        return encodeRespInteger(count);
    } else if (upperCmd === "EXISTS" && args.length === 1) {
        const [key] = args;
        return encodeRespInteger(key in dataStore ? 1 : 0);
    } else {
        return encodeRespError("Unknown command or invalid arguments");
    }
}

// Server Setup
const server = net.createServer((socket) => {
    console.log("Client connected");
    socket.write(encodeRespString("Welcome to the Redis-like server!"));

    let buffer = ""; // Buffer for incomplete commands

    socket.on("data", (chunk) => {
        try {
            buffer += chunk.toString();

            // Process complete commands
            while (buffer.includes("\r\n")) {
                const splitIndex = buffer.indexOf("\r\n") + 2;
                const commandString = buffer.slice(0, splitIndex);
                buffer = buffer.slice(splitIndex);

                const command = parseRespCommand(commandString);
                if (command) {
                    const response = handleCommand(command);
                    socket.write(response);
                } else {
                    socket.write(encodeRespError("Invalid command format"));
                }
            }
        } catch (err) {
            console.error("Error processing command:", err.message);
            socket.write(encodeRespError("Internal server error"));
        }
    });

    socket.on("end", () => {
        console.log("Client disconnected");
    });

    socket.on("error", (err) => {
        console.error("Socket error:", err.message);
    });
});

// Start server
const PORT = 6379;
server.listen(PORT, () => {
    console.log(`Redis-like server running on port ${PORT}`);
});
