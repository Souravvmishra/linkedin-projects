const http = require('http');
const axios = require('axios'); // For health checks

// Backend server list
const servers = [
    { url: 'http://localhost:8080', isHealthy: true },
    { url: 'http://localhost:8081', isHealthy: true },
];

let currentIndex = 0; // To track the server to forward the next request

// Health check interval (in milliseconds)
const healthCheckInterval = 10000;

// Function to forward requests to backend servers
const forwardRequest = (req, res) => {
    const server = getNextServer();

    if (!server) {
        res.statusCode = 503;
        res.end('No healthy servers available.');
        return;
    }

    const options = {
        hostname: new URL(server.url).hostname,
        port: new URL(server.url).port,
        path: req.url,
        method: req.method,
        headers: req.headers,
    };

    const proxy = http.request(options, (serverRes) => {
        res.writeHead(serverRes.statusCode, serverRes.headers);
        serverRes.pipe(res, { end: true });
    });

    proxy.on('error', (err) => {
        console.error(`Error forwarding request to ${server.url}:`, err.message);
        res.statusCode = 502;
        res.end('Bad Gateway');
    });

    req.pipe(proxy, { end: true });
};

// Function to get the next healthy server using round-robin
const getNextServer = () => {
    const healthyServers = servers.filter((server) => server.isHealthy);

    if (healthyServers.length === 0) return null;

    // Get the current server and increment the index for next time
    const server = servers[currentIndex];
    currentIndex = (currentIndex + 1) % servers.length;
    
    // If the selected server is not healthy, try the next one
    if (!server.isHealthy) {
        return getNextServer();
    }
    
    return server;
};

// Health check logic
const performHealthChecks = () => {
    servers.forEach((server) => {
        axios
            .get(server.url)
            .then((response) => {
                if (response.status === 200) {
                    server.isHealthy = true;
                } else {
                    server.isHealthy = false;
                }
            })
            .catch(() => {
                server.isHealthy = false;
            });
    });
};

// Start periodic health checks
setInterval(performHealthChecks, healthCheckInterval);

// Start the load balancer
const server = http.createServer((req, res) => {
    console.log(`Received request: ${req.method} ${req.url}`);
    forwardRequest(req, res);
});

const PORT = 80;
server.listen(PORT, () => {
    console.log(`Load balancer listening on port ${PORT}`);
});
