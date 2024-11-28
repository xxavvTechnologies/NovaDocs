const WebSocket = require('ws');
const http = require('http');

// Create HTTP server
const server = http.createServer();

// Create WebSocket server
const wss = new WebSocket.Server({ server });

// Active peers
const peers = new Set();

// Utility function to broadcast message to all clients
function broadcastPeerList() {
    wss.clients.forEach((client) => {
        if (client.readyState === WebSocket.OPEN) {
            try {
                client.send(JSON.stringify({
                    type: 'peer-list',
                    peers: Array.from(peers)
                }));
            } catch (error) {
                console.error('Error broadcasting peer list:', error);
            }
        }
    });
}

wss.on('connection', (ws) => {
    let currentPeerId = null;

    ws.on('message', (message) => {
        try {
            const data = JSON.parse(message);

            switch(data.type) {
                case 'register':
                    if (!data.peerId) {
                        console.warn('Received register message without peerId');
                        return;
                    }

                    currentPeerId = data.peerId;
                    peers.add(currentPeerId);
                    
                    // Broadcast updated peer list to all clients
                    broadcastPeerList();
                    break;

                case 'offer':
                case 'answer':
                case 'ice-candidate':
                    // Validate signaling message
                    if (!data.target) {
                        console.warn('Signaling message without target:', data.type);
                        return;
                    }

                    // Relay signaling messages to specific peer
                    wss.clients.forEach((client) => {
                        if (client !== ws && client.readyState === WebSocket.OPEN) {
                            try {
                                client.send(JSON.stringify(data));
                            } catch (error) {
                                console.error('Error relaying message:', error);
                            }
                        }
                    });
                    break;

                default:
                    console.warn('Received unknown message type:', data.type);
            }
        } catch (error) {
            console.error('Error processing message:', error);
        }
    });

    ws.on('close', () => {
        if (currentPeerId) {
            peers.delete(currentPeerId);
            
            // Broadcast updated peer list
            broadcastPeerList();
        }
    });

    ws.on('error', (error) => {
        console.error('WebSocket error:', error);
    });
});

// Error handling for the server
server.on('error', (error) => {
    console.error('HTTP server error:', error);
});

// Configure server to listen
const PORT = process.env.PORT || 8080;
server.listen(PORT, () => {
    console.log(`Signaling server running on port ${PORT}`);
});

// Graceful shutdown
process.on('SIGINT', () => {
    console.log('Closing server...');
    wss.close(() => {
        server.close(() => {
            process.exit(0);
        });
    });
});