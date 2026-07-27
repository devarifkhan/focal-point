import WEBSOCKET_CONFIG, { validateMessage, createMessage } from '../config/websocket.js';
import { WEBSOCKET_BASE_URL } from '../config/config.js';
import { handleTokenExpiration, isTokenExpiredError } from '../utils/authUtils.js';

class WebSocketService {
    constructor() {
        this.connections = new Map(); // Store multiple WebSocket connections
        this.reconnectAttempts = new Map();
        this.messageQueue = new Map(); // Queue messages when disconnected
        this.eventListeners = new Map();
        this.heartbeatIntervals = new Map(); // Store heartbeat intervals
    }

    // Get WebSocket URL based on environment
    getWebSocketBaseUrl() {
        return WEBSOCKET_BASE_URL;
    }

    // Connect to URL list WebSocket
    async connectToUrlList(userId, token) {
        const connectionKey = `urls_list_${userId}`;
        
        if (this.connections.has(connectionKey)) {
            console.log('URL list WebSocket already connected');
            return this.connections.get(connectionKey);
        }

        const wsUrl = `${this.getWebSocketBaseUrl()}${WEBSOCKET_CONFIG.ROUTES.URL_LIST(userId)}`;
        console.log('Connecting to URL list WebSocket:', wsUrl);

        try {
            const ws = new WebSocket(wsUrl);
            
            ws.onopen = () => {
                console.log('URL list WebSocket connected');
                this.reconnectAttempts.set(connectionKey, 0);
                
                // Send authentication and request URLs
                this.sendMessage(connectionKey, createMessage(
                    WEBSOCKET_CONFIG.MESSAGE_TYPES.GET_URLS,
                    token
                ));

                // Process queued messages
                this.processQueuedMessages(connectionKey);
            };

            ws.onmessage = (event) => {
                try {
                    const data = JSON.parse(event.data);
                    this.handleUrlListMessage(data);
                } catch (error) {
                    console.error('Error parsing WebSocket message:', error);
                }
            };

            ws.onclose = (event) => {
                console.log('URL list WebSocket closed:', event.code, event.reason);
                this.connections.delete(connectionKey);
                this.scheduleReconnect(connectionKey, userId, token);
            };

            ws.onerror = (error) => {
                console.error('URL list WebSocket error:', error);
            };

            this.connections.set(connectionKey, ws);
            return ws;

        } catch (error) {
            console.error('Error creating URL list WebSocket:', error);
            throw error;
        }
    }

    // Connect to URL update WebSocket
    async connectToUrlUpdate(urlId, token) {
        const connectionKey = `url_update_${urlId}`;
        
        if (this.connections.has(connectionKey)) {
            console.log('URL update WebSocket already connected');
            return this.connections.get(connectionKey);
        }

        const wsUrl = `${this.getWebSocketBaseUrl()}${WEBSOCKET_CONFIG.ROUTES.URL_UPDATE(urlId)}`;
        console.log('Connecting to URL update WebSocket:', wsUrl);

        try {
            const ws = new WebSocket(wsUrl);
            
            ws.onopen = () => {
                console.log('URL update WebSocket connected for URL:', urlId);
                this.reconnectAttempts.set(connectionKey, 0);
                this.processQueuedMessages(connectionKey);
            };

            ws.onmessage = (event) => {
                try {
                    const data = JSON.parse(event.data);
                    this.handleUrlUpdateMessage(data);
                } catch (error) {
                    console.error('Error parsing WebSocket message:', error);
                }
            };

            ws.onclose = (event) => {
                console.log('URL update WebSocket closed:', event.code, event.reason);
                this.connections.delete(connectionKey);
                this.scheduleReconnect(connectionKey, urlId, token, 'update');
            };

            ws.onerror = (error) => {
                console.error('URL update WebSocket error:', error);
            };

            this.connections.set(connectionKey, ws);
            return ws;

        } catch (error) {
            console.error('Error creating URL update WebSocket:', error);
            throw error;
        }
    }

    // Handle URL list messages
    handleUrlListMessage(data) {
        if (data.action === WEBSOCKET_CONFIG.MESSAGE_TYPES.URLS_LIST && data.data && data.data.urls) {
            console.log('Received URL list:', data.data.urls.length, 'URLs');
            this.notifyListeners('urls_received', data.data.urls);
        } else if (data.error) {
            console.error('URL list WebSocket error:', data.error);
            
            // Check for token expiration
            if (isTokenExpiredError(data.error)) {
                console.log('WebSocket token expired, logging out user');
                handleTokenExpiration();
                return;
            }
            
            this.notifyListeners('urls_error', data.error);
        }
    }

    // Handle URL update messages
    handleUrlUpdateMessage(data) {
        if (data.action === WEBSOCKET_CONFIG.MESSAGE_TYPES.URL_UPDATED && data.data) {
            console.log('URL updated:', data.data);
            this.notifyListeners('url_updated', data.data);
        } else if (data.error) {
            console.error('URL update WebSocket error:', data.error);
            
            // Check for token expiration
            if (isTokenExpiredError(data.error)) {
                console.log('WebSocket token expired, logging out user');
                handleTokenExpiration();
                return;
            }
            
            this.notifyListeners('url_update_error', data.error);
        }
    }

    // Send message to WebSocket
    sendMessage(connectionKey, message) {
        const ws = this.connections.get(connectionKey);
        
        if (ws && ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify(message));
        } else {
            // Queue message if connection is not ready
            if (!this.messageQueue.has(connectionKey)) {
                this.messageQueue.set(connectionKey, []);
            }
            this.messageQueue.get(connectionKey).push(message);
            console.log('Message queued for connection:', connectionKey);
        }
    }

    // Process queued messages
    processQueuedMessages(connectionKey) {
        const queue = this.messageQueue.get(connectionKey);
        if (queue && queue.length > 0) {
            console.log('Processing', queue.length, 'queued messages for', connectionKey);
            queue.forEach(message => {
                this.sendMessage(connectionKey, message);
            });
            this.messageQueue.set(connectionKey, []);
        }
    }

    // Schedule reconnection
    scheduleReconnect(connectionKey, identifier, token, type = 'list') {
        const attempts = this.reconnectAttempts.get(connectionKey) || 0;
        
        if (attempts < WEBSOCKET_CONFIG.MAX_RECONNECT_ATTEMPTS) {
            const delay = WEBSOCKET_CONFIG.RECONNECT_DELAY * Math.pow(WEBSOCKET_CONFIG.RECONNECT_BACKOFF_MULTIPLIER, attempts);
            console.log(`Scheduling reconnect for ${connectionKey} in ${delay}ms (attempt ${attempts + 1})`);
            
            setTimeout(async () => {
                this.reconnectAttempts.set(connectionKey, attempts + 1);
                try {
                    if (type === 'update') {
                        await this.connectToUrlUpdate(identifier, token);
                    } else {
                        await this.connectToUrlList(identifier, token);
                    }
                } catch (error) {
                    console.error('Reconnection failed:', error);
                }
            }, delay);
        } else {
            console.error('Max reconnection attempts reached for', connectionKey);
            this.notifyListeners('connection_failed', connectionKey);
        }
    }

    // Add event listener
    addEventListener(event, callback) {
        if (!this.eventListeners.has(event)) {
            this.eventListeners.set(event, []);
        }
        this.eventListeners.get(event).push(callback);
    }

    // Remove event listener
    removeEventListener(event, callback) {
        const listeners = this.eventListeners.get(event);
        if (listeners) {
            const index = listeners.indexOf(callback);
            if (index > -1) {
                listeners.splice(index, 1);
            }
        }
    }

    // Notify listeners
    notifyListeners(event, data) {
        const listeners = this.eventListeners.get(event);
        if (listeners) {
            listeners.forEach(callback => {
                try {
                    callback(data);
                } catch (error) {
                    console.error('Error in event listener:', error);
                }
            });
        }
    }

    // Request URL list
    async requestUrlList(userId, token) {
        const connectionKey = `urls_list_${userId}`;
        
        // Ensure connection exists
        if (!this.connections.has(connectionKey)) {
            await this.connectToUrlList(userId, token);
        }

        this.sendMessage(connectionKey, createMessage(
            WEBSOCKET_CONFIG.MESSAGE_TYPES.GET_URLS,
            token
        ));
    }

    // Update URL
    async updateUrl(urlId, token, updateData) {
        const connectionKey = `url_update_${urlId}`;
        
        // Ensure connection exists
        if (!this.connections.has(connectionKey)) {
            await this.connectToUrlUpdate(urlId, token);
        }

        this.sendMessage(connectionKey, createMessage(
            WEBSOCKET_CONFIG.MESSAGE_TYPES.UPDATE_URL,
            token,
            { update_data: updateData }
        ));
    }

    // Close specific connection
    closeConnection(connectionKey) {
        const ws = this.connections.get(connectionKey);
        if (ws) {
            ws.close();
            this.connections.delete(connectionKey);
            this.messageQueue.delete(connectionKey);
            this.reconnectAttempts.delete(connectionKey);
        }
    }

    // Close all connections
    closeAllConnections() {
        this.connections.forEach((ws, key) => {
            ws.close();
        });
        this.connections.clear();
        this.messageQueue.clear();
        this.reconnectAttempts.clear();
    }

    // Get connection status
    getConnectionStatus(connectionKey) {
        const ws = this.connections.get(connectionKey);
        if (!ws) return 'disconnected';
        
        switch (ws.readyState) {
            case WebSocket.CONNECTING: return 'connecting';
            case WebSocket.OPEN: return 'connected';
            case WebSocket.CLOSING: return 'closing';
            case WebSocket.CLOSED: return 'closed';
            default: return 'unknown';
        }
    }
}

// Create singleton instance
const webSocketService = new WebSocketService();

export default webSocketService;