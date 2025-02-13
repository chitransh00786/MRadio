import logger from '../utils/logger.js';

class SSEManager {
    constructor() {
        this.clients = new Set();
    }

    addClient(req, res) {
        // Set headers for SSE
        res.writeHead(200, {
            'Content-Type': 'text/event-stream',
            'Cache-Control': 'no-cache',
            'Connection': 'keep-alive',
            'Access-Control-Allow-Origin': '*'
        });

        // Prevent response timeout
        req.socket.setTimeout(0);
        req.socket.setNoDelay(true);
        req.socket.setKeepAlive(true);

        // Add client to the set
        this.clients.add(res);
        logger.info('SSE client connected');

        // Setup heartbeat
        const heartbeatInterval = setInterval(() => {
            if (!res.writableEnded) {
                res.write(`event: heartbeat\ndata: ${JSON.stringify({ timestamp: Date.now() })}\n\n`);
            } else {
                clearInterval(heartbeatInterval);
            }
        }, 15000);

        // Remove client on connection close
        req.on('close', () => {
            this.clients.delete(res);
            clearInterval(heartbeatInterval);
            logger.info('SSE client disconnected');
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
