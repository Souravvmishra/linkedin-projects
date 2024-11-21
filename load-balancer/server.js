const http = require('http');

const startTestServers = () => {
    const createTestServer = (port, message) => {
        http
            .createServer((req, res) => {
                console.log(`Request received on backend server ${port}`);
                res.writeHead(200, { 'Content-Type': 'text/plain' });
                res.end(message);
            })
            .listen(port, () => console.log(`Backend server running on port ${port}`));
    };

    createTestServer(8080, 'Hello from server 8080');
    createTestServer(8081, 'Hello from server 8081');
};

startTestServers();
