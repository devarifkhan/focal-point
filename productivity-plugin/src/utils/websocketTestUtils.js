// WebSocket Test Utilities
// These functions can be used to test the WebSocket tab reload functionality

/**
 * Test function to simulate URL status change and trigger tab reload
 * Usage: testWebSocketReload('youtube.com', false) - to unblock and reload
 *        testWebSocketReload('youtube.com', true) - to block and reload
 */
export function testWebSocketReload(url, isBlocked = false) {
    return new Promise((resolve, reject) => {
        chrome.runtime.sendMessage({
            type: 'reloadMatchingTabs',
            url: url,
            isBlocked: isBlocked
        }, (response) => {
            if (chrome.runtime.lastError) {
                reject(chrome.runtime.lastError);
            } else if (response.success) {
                console.log(`✅ Successfully ${isBlocked ? 'blocked' : 'unblocked'} and reloaded tabs for: ${url}`);
                resolve(response);
            } else {
                reject(new Error(response.error || 'Unknown error'));
            }
        });
    });
}

/**
 * Test function to check WebSocket connection status
 */
export function checkWebSocketStatus() {
    // This would need to be implemented in the background script
    console.log('WebSocket status check - implement in background script');
}

/**
 * Simulate a WebSocket message for testing
 * This creates a fake URL update message to test the reload functionality
 */
export function simulateWebSocketMessage(urlData) {
    const oldData = { ...urlData, visited: urlData.visited === "true" ? "false" : "true" };
    const newData = { ...urlData };
    
    console.log('Simulating WebSocket message:', { oldData, newData });
    
    // This would trigger the handleUrlStatusChange function
    return testWebSocketReload(urlData.block_urls, newData.visited === "true");
}

// Make functions available globally for console testing
if (typeof window !== 'undefined') {
    window.testWebSocketReload = testWebSocketReload;
    window.checkWebSocketStatus = checkWebSocketStatus;
    window.simulateWebSocketMessage = simulateWebSocketMessage;
}

// Console usage examples:
console.log(`
WebSocket Test Utils Loaded!

Usage examples:
1. Test unblocking YouTube:
   testWebSocketReload('youtube.com', false)

2. Test blocking Facebook:
   testWebSocketReload('facebook.com', true)

3. Simulate WebSocket message:
   simulateWebSocketMessage({
     block_urls: 'twitter.com',
     visited: 'true',
     id: 123
   })
`);