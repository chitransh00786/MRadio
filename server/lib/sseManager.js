import logger from '../utils/logger.js';

class SSEManager {
    constructor() {
        this.clients = new Set();
    }

    addClient(req, res) {
        // Set headers for SSE with retry configuration
        res.writeHead(200, {
            'Content-Type': 'text/event-stream',
            'Cache-Control': 'no-cache',
            'Connection': 'keep-alive',
            'Access-Control-Allow-Origin': '*',
            'X-Accel-Buffering': 'no' // Disable proxy buffering
        });

        // Send retry interval to client (3 seconds)
        res.write('retry: 3000\n\n');

        // Prevent response timeout
        req.socket.setTimeout(0);
        req.socket.setNoDelay(true);
        req.socket.setKeepAlive(true);

        // Add client to the set
        this.clients.add(res);
        logger.info('SSE client connected');

        // Setup more frequent heartbeat (5 seconds)
        const heartbeatInterval = setInterval(() => {
            if (!res.writableEnded) {
                try {
                    res.write(`event: heartbeat\ndata: ${JSON.stringify({ timestamp: Date.now() })}\n\n`);
                } catch (error) {
                    logger.error('Heartbeat error:', { message: error.message });
                    clearInterval(heartbeatInterval);
                    this.clients.delete(res);
                }
            } else {
                clearInterval(heartbeatInterval);
                this.clients.delete(res);
            }
        }, 5000);

        // Setup connection timeout check (30 seconds)
        const timeoutInterval = setInterval(() => {
            if (Date.now() - req.socket.lastTimeoutCheck > 30000) {
                logger.warn('SSE connection timeout, closing connection');
                clearInterval(timeoutInterval);
                clearInterval(heartbeatInterval);
                this.clients.delete(res);
                try {
                    res.end();
                } catch (error) {
                    logger.error('Error closing timed out connection:', { message: error.message });
                }
            }
        }, 30000);

        // Initialize last timeout check
        req.socket.lastTimeoutCheck = Date.now();

        // Update last timeout check on data
        req.socket.on('data', () => {
            req.socket.lastTimeoutCheck = Date.now();
        });

        // Remove client and clear intervals on connection close
        req.on('close', () => {
            this.clients.delete(res);
            clearInterval(heartbeatInterval);
            clearInterval(timeoutInterval);
            logger.info('SSE client disconnected');
        });

        // Handle errors
        req.on('error', (error) => {
            logger.error('SSE connection error:', { message: error.message });
            this.clients.delete(res);
            clearInterval(heartbeatInterval);
            clearInterval(timeoutInterval);
            try {
                res.end();
            } catch (err) {
                logger.error('Error closing errored connection:', { message: err.message });
            }
        });
    }

    sendToAll(data, event = 'message') {
        const payload = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
        
        this.clients.forEach(client => {
            try {
                if (!client.writableEnded) {
                    client.write(payload);
                } else {
                    this.clients.delete(client);
                }
            } catch (error) {
                logger.error('Error sending SSE data:', error);
                this.clients.delete(client);
            }
        });
    }
}

const sseManager = new SSEManager();

export const initSSE = (req, res) => {
    try {
        sseManager.addClient(req, res);
    } catch (error) {
        logger.error('Error initializing SSE:', error);
        res.status(500).end();
    }
};

export const sendSSEData = (data, event = 'message') => {
    try {
        sseManager.sendToAll(data, event);
    } catch (error) {
        logger.error('Error sending SSE data:', error);
        logger.error('Data attempted to send:', data);
    }
};
