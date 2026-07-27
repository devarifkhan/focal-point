import webSocketService from './WebSocketService.js';
import { getAccessToken } from '../pages/Background/modules/storage.js';

class WebSocketApiService {
    constructor() {
        this.isInitialized = false;
        this.currentUserId = null;
        this.urlListCache = [];
        this.notifyTimeout = null;
        this.setupEventListeners();
    }

    // Initialize WebSocket connections
    async initialize() {
        if (this.isInitialized) return;

        try {
            const token = await getAccessToken();
            if (!token) {
                console.log('No token available, skipping WebSocket initialization');
                return;
            }

            // Extract user ID from token or use a default
            this.currentUserId = this.extractUserIdFromToken(token) || 'default';
            
            // Connect to URL list WebSocket
            await webSocketService.connectToUrlList(this.currentUserId, token);
            
            this.isInitialized = true;
            console.log('WebSocket API service initialized');
        } catch (error) {
            console.error('Error initializing WebSocket API service:', error);
        }
    }

    // Setup event listeners for WebSocket messages
    setupEventListeners() {
        webSocketService.addEventListener('urls_received', (urls) => {
            this.urlListCache = urls;
            // console.log('URL list cache updated with', urls.length, 'URLs');
            // console.log('🔍 API DATA STRUCTURE:', JSON.stringify(urls, null, 2));
        });

        webSocketService.addEventListener('urls_error', (error) => {
            console.error('WebSocket URL list error:', error);
        });

        webSocketService.addEventListener('url_updated', (urlData) => {
            // console.log('🔴 REAL-TIME WebSocket url_updated received:', urlData);
            
            // Update cache with real-time data
            const index = this.urlListCache.findIndex(url => url.id === urlData.id);
            if (index !== -1) {
                const oldData = this.urlListCache[index];
                this.urlListCache[index] = urlData; // Use real-time data, not cache
                console.log('🔴 REAL-TIME UPDATE:', urlData.id, 'visited:', oldData.visited, '→', urlData.visited);
                
                // Accept server state - if server says site is unblocked, respect that
                console.log(`Accepting server state: ${urlData.block_urls} visited=${urlData.visited}`);
            } else {
                this.urlListCache.push(urlData);
            }
            
            // Immediately notify UI with real-time data (bypass cache)
            this.notifyOptionsPageRealTime(urlData);
        });

        webSocketService.addEventListener('url_update_error', (error) => {
            console.error('WebSocket URL update error:', error);
        });

        webSocketService.addEventListener('connection_failed', (connectionKey) => {
            console.error('WebSocket connection failed:', connectionKey);
            // Could implement fallback to HTTP API here
        });
    }

    // Extract user ID from JWT token
    extractUserIdFromToken(token) {
        try {
            const payload = JSON.parse(atob(token.split('.')[1]));
            return payload.user_id || payload.sub || payload.id;
        } catch (error) {
            console.error('Error extracting user ID from token:', error);
            return null;
        }
    }

    // Fetch URLs using WebSocket
    async fetchUrls() {
        try {
            const token = await getAccessToken();
            if (!token) {
                console.log('No token available for WebSocket URL fetch');
                return this.urlListCache; // Return cached data if no token
            }

            // Initialize if not already done
            if (!this.isInitialized) {
                await this.initialize();
            }

            // Request fresh URL list
            await webSocketService.requestUrlList(this.currentUserId, token);
            
            // Return cached data immediately (will be updated via WebSocket)
            return this.urlListCache;
        } catch (error) {
            console.error('Error fetching URLs via WebSocket:', error);
            return this.urlListCache; // Return cached data on error
        }
    }

    // Update URL using WebSocket
    async updateUrl(id, updateData) {
        try {
            const token = await getAccessToken();
            if (!token) {
                throw new Error('No token available for WebSocket URL update');
            }

            // Convert FormData to plain object if needed
            let dataToSend = updateData;
            if (updateData instanceof FormData) {
                dataToSend = {};
                for (let [key, value] of updateData.entries()) {
                    dataToSend[key] = value;
                }
            }

            // Send update via WebSocket
            await webSocketService.updateUrl(id, token, dataToSend);
            
            console.log('URL update sent via WebSocket:', id);
            return { success: true };
        } catch (error) {
            console.error('Error updating URL via WebSocket:', error);
            throw error;
        }
    }

    // Get cached URL list
    getCachedUrls() {
        return this.urlListCache;
    }
    
    // Get specific URL from cache
    getCachedUrl(urlId) {
        return this.urlListCache.find(url => url.id === urlId);
    }
    
    // Update specific URL in cache
    updateCachedUrl(urlData) {
        const index = this.urlListCache.findIndex(url => url.id === urlData.id);
        if (index !== -1) {
            this.urlListCache[index] = { ...this.urlListCache[index], ...urlData };
            console.log(`Updated cached URL: ${urlData.block_urls || urlData.id} with visited=${urlData.visited}`);
            return true;
        } else {
            // If URL not found in cache, add it
            this.urlListCache.push(urlData);
            console.log(`Added new URL to cache: ${urlData.block_urls || urlData.id}`);
            return true;
        }
    }

    // Check if WebSocket is connected
    isConnected() {
        if (!this.currentUserId) return false;
        
        const connectionKey = `urls_list_${this.currentUserId}`;
        return webSocketService.getConnectionStatus(connectionKey) === 'connected';
    }

    // Reconnect WebSocket connections
    async reconnect() {
        try {
            const token = await getAccessToken();
            if (!token) return;

            this.currentUserId = this.extractUserIdFromToken(token) || 'default';
            await webSocketService.connectToUrlList(this.currentUserId, token);
        } catch (error) {
            console.error('Error reconnecting WebSocket:', error);
        }
    }

    // Close WebSocket connections
    disconnect() {
        if (this.currentUserId) {
            const connectionKey = `urls_list_${this.currentUserId}`;
            webSocketService.closeConnection(connectionKey);
        }
        this.isInitialized = false;
        this.currentUserId = null;
        this.urlListCache = []; // Clear cache
    }

    // Add event listener for URL updates
    onUrlsUpdated(callback) {
        webSocketService.addEventListener('urls_received', callback);
    }

    // Add event listener for single URL updates
    onUrlUpdated(callback) {
        webSocketService.addEventListener('url_updated', callback);
    }

    // Remove event listeners
    removeEventListener(event, callback) {
        webSocketService.removeEventListener(event, callback);
    }

    // Notify options page with real-time data (immediate)
    notifyOptionsPageRealTime(urlData) {
        try {
            chrome.runtime.sendMessage({
                type: 'WEBSOCKET_REALTIME_UPDATE',
                data: {
                    url: urlData, // Send individual URL update
                    timestamp: Date.now()
                }
            });
        } catch (error) {
            // Ignore errors
        }
    }
    
    // Notify options page to refresh UI (debounced for bulk updates)
    notifyOptionsPage() {
        if (this.notifyTimeout) {
            clearTimeout(this.notifyTimeout);
        }
        
        this.notifyTimeout = setTimeout(() => {
            try {
                chrome.runtime.sendMessage({
                    type: 'WEBSOCKET_URL_UPDATE',
                    data: {
                        urls: this.urlListCache,
                        timestamp: Date.now()
                    }
                });
            } catch (error) {
                // Ignore errors
            }
        }, 200);
    }
    
    // Notify when a website becomes blocked
    notifyBlockedStateChange(urlData) {
        try {
            chrome.runtime.sendMessage({
                type: 'WEBSITE_BLOCKED',
                data: {
                    url: urlData,
                    timestamp: Date.now()
                }
            }, () => {
                if (chrome.runtime.lastError) {
                    // Ignore connection errors
                }
            });
            
            console.log('Sent blocked state change notification for:', urlData.block_urls);
        } catch (error) {
            console.error('Error sending blocked state notification:', error);
        }
    }
    

}

// Create singleton instance
const webSocketApiService = new WebSocketApiService();

export default webSocketApiService;