// WebSocket configuration
export const WEBSOCKET_CONFIG = {
    // Base WebSocket URL (will be derived from API_BASE_URL)
    BASE_URL: null, // Set dynamically from API_BASE_URL
    
    // Connection settings
    MAX_RECONNECT_ATTEMPTS: 5,
    RECONNECT_DELAY: 3000, // 3 seconds
    RECONNECT_BACKOFF_MULTIPLIER: 2, // Exponential backoff
    
    // Message queue settings
    MAX_QUEUE_SIZE: 100,
    QUEUE_TIMEOUT: 30000, // 30 seconds
    
    // Connection timeout
    CONNECTION_TIMEOUT: 10000, // 10 seconds
    
    // Heartbeat settings
    HEARTBEAT_INTERVAL: 30000, // 30 seconds
    HEARTBEAT_TIMEOUT: 1000, // 5 seconds
    
    // Routes
    ROUTES: {
        URL_LIST: (userId) => `/ws/urls/list/${userId}/`,
        URL_UPDATE: (urlId) => `/ws/urls/update/${urlId}/`
    },
    
    // Message types
    MESSAGE_TYPES: {
        // Outgoing
        GET_URLS: 'get_urls',
        UPDATE_URL: 'update_url',
        PING: 'ping',
        
        // Incoming
        URLS_LIST: 'urls_list',
        URL_UPDATED: 'url_updated',
        ERROR: 'error',
        PONG: 'pong'
    },
    
    // Error codes
    ERROR_CODES: {
        TOKEN_REQUIRED: 'Token required',
        INVALID_TOKEN: 'Invalid or expired token',
        UNAUTHORIZED: 'Unauthorized access',
        URL_NOT_FOUND: 'URL not found or unauthorized'
    }
};



// Validate WebSocket message
export function validateMessage(message) {
    if (!message || typeof message !== 'object') {
        return { valid: false, error: 'Message must be an object' };
    }
    
    if (!message.action) {
        return { valid: false, error: 'Message must have an action field' };
    }
    
    if (!message.token && message.action !== WEBSOCKET_CONFIG.MESSAGE_TYPES.PING) {
        return { valid: false, error: 'Message must have a token field' };
    }
    
    return { valid: true };
}

// Create WebSocket message
export function createMessage(action, token, data = {}) {
    const message = {
        action,
        ...data
    };
    
    if (token) {
        message.token = token;
    }
    
    return message;
}

export default WEBSOCKET_CONFIG;