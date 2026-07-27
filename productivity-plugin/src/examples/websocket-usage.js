// Example usage of WebSocket functionality
// This file demonstrates how to use the WebSocket services

import webSocketApiService from '../services/WebSocketApiService.js';
import { getAccessToken } from '../pages/Background/modules/storage.js';

// Example: Initialize and use WebSocket for URL management
async function exampleWebSocketUsage() {
    try {
        // 1. Initialize WebSocket service
        console.log('Initializing WebSocket service...');
        await webSocketApiService.initialize();
        
        // 2. Set up event listeners for real-time updates
        webSocketApiService.onUrlsUpdated((urls) => {
            console.log('Received URL list update:', urls.length, 'URLs');
            // Handle URL list updates here
            urls.forEach(url => {
                console.log(`- ${url.block_urls}: ${url.used_time}/${url.default_time} minutes`);
            });
        });
        
        webSocketApiService.onUrlUpdated((urlData) => {
            console.log('Received individual URL update:', urlData);
            // Handle individual URL updates here
        });
        
        // 3. Fetch URLs (will use WebSocket if available, fallback to HTTP)
        console.log('Fetching URLs...');
        const urls = await webSocketApiService.fetchUrls();
        console.log('Current URLs:', urls);
        
        // 4. Update a URL (example)
        if (urls.length > 0) {
            const urlToUpdate = urls[0];
            console.log('Updating URL:', urlToUpdate.id);
            
            const updateData = {
                used_time: parseFloat(urlToUpdate.used_time || 0) + 1, // Add 1 minute
                visited: false
            };
            
            await webSocketApiService.updateUrl(urlToUpdate.id, updateData);
            console.log('URL update sent via WebSocket');
        }
        
        // 5. Check connection status
        console.log('WebSocket connected:', webSocketApiService.isConnected());
        
    } catch (error) {
        console.error('Error in WebSocket usage example:', error);
    }
}

// Example: Handle WebSocket connection states
function setupConnectionMonitoring() {
    // Monitor connection status
    setInterval(() => {
        const isConnected = webSocketApiService.isConnected();
        console.log('WebSocket connection status:', isConnected ? 'Connected' : 'Disconnected');
        
        if (!isConnected) {
            console.log('Attempting to reconnect...');
            webSocketApiService.reconnect();
        }
    }, 30000); // Check every 30 seconds
}

// Example: Cleanup on extension unload
function setupCleanup() {
    // Listen for extension suspend/unload
    if (typeof chrome !== 'undefined' && chrome.runtime) {
        chrome.runtime.onSuspend.addListener(() => {
            console.log('Extension suspending, cleaning up WebSocket connections...');
            webSocketApiService.disconnect();
        });
    }
}

// Example: Integration with existing time tracking
async function integrateWithTimeTracking() {
    // This shows how the WebSocket service integrates with existing time tracking
    
    // Listen for URL updates and sync with local state
    webSocketApiService.onUrlUpdated((urlData) => {
        console.log('Syncing URL data with local state:', urlData);
        
        // Update local tracking state
        // This would typically be handled by the stateManager
        const trackingUrl = urlData.block_urls;
        
        // Example: Update accumulated time if it changed
        if (urlData.used_time) {
            const timeInMs = parseFloat(urlData.used_time) * 60000;
            console.log(`Updating local time for ${trackingUrl}: ${timeInMs}ms`);
            // accumulatedTime[trackingUrl] = timeInMs; // This would be done in stateManager
        }
    });
    
    // Example: Periodic sync to ensure consistency
    setInterval(async () => {
        try {
            const urls = await webSocketApiService.fetchUrls();
            console.log('Periodic sync: received', urls.length, 'URLs');
            // Process any updates that might have been missed
        } catch (error) {
            console.error('Error in periodic sync:', error);
        }
    }, 60000); // Sync every minute as backup
}

// Export examples for use in other parts of the extension
export {
    exampleWebSocketUsage,
    setupConnectionMonitoring,
    setupCleanup,
    integrateWithTimeTracking
};

// Auto-run example if this file is imported
console.log('WebSocket usage examples loaded. Call exampleWebSocketUsage() to test.');