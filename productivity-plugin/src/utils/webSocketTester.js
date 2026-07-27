// WebSocket Test Utility for Blocked Websites
// This utility helps test the real-time WebSocket updates when websites become blocked

class WebSocketTester {
    constructor() {
        this.isInitialized = false;
    }

    // Initialize the tester
    async initialize() {
        if (this.isInitialized) return;
        
        console.log('WebSocket Tester initialized');
        this.isInitialized = true;
        
        // Set up message listeners for testing
        this.setupMessageListeners();
    }

    // Set up message listeners to monitor WebSocket activity
    setupMessageListeners() {
        if (typeof chrome !== 'undefined' && chrome.runtime) {
            chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
                if (message.type === 'WEBSOCKET_URL_UPDATE') {
                    console.log('🔄 WebSocket URL Update:', message.data);
                    this.logUrlUpdate(message.data);
                } else if (message.type === 'WEBSITE_BLOCKED') {
                    console.log('🚫 Website Blocked:', message.data);
                    this.logWebsiteBlocked(message.data);
                }
            });
        }
    }

    // Log URL updates
    logUrlUpdate(data) {
        console.group('📊 URL List Update');
        console.log('Timestamp:', new Date(data.timestamp).toLocaleTimeString());
        console.log('Total URLs:', data.urls?.length || 0);
        
        if (data.urls && data.urls.length > 0) {
            const blockedUrls = data.urls.filter(url => url.visited === "true" || url.visited === true);
            const activeUrls = data.urls.filter(url => url.visited === "false" || url.visited === false);
            
            console.log('🚫 Blocked URLs:', blockedUrls.length);
            console.log('✅ Active URLs:', activeUrls.length);
            
            // Show recently blocked URLs
            blockedUrls.forEach(url => {
                console.log(`  - ${url.block_urls} (${url.used_time || url.time || 0} min used)`);
            });
        }
        console.groupEnd();
    }

    // Log website blocked events
    logWebsiteBlocked(data) {
        console.group('🚫 Website Blocked Event');
        console.log('Timestamp:', new Date(data.timestamp).toLocaleTimeString());
        
        if (data.url) {
            console.log('🌐 URL:', data.url.block_urls);
            console.log('⏱️ Time Used:', data.url.used_time || data.url.time || 0, 'minutes');
            console.log('⏰ Time Limit:', data.url.temporary_time || data.url.default_time || 0, 'minutes');
            console.log('🔄 Is Temporary:', data.url.is_temporary);
            
            if (data.url.redirect_urls) {
                console.log('↗️ Redirect URL:', data.url.redirect_urls);
            }
            
            if (data.url.message) {
                console.log('💬 Custom Message:', data.url.message);
            }
        }
        console.groupEnd();
    }

    // Simulate a website becoming blocked (for testing)
    async simulateWebsiteBlocked(blockUrl, timeUsed = 5) {
        console.log('🧪 Simulating website blocked:', blockUrl);
        
        const simulatedData = {
            type: 'WEBSITE_BLOCKED',
            data: {
                url: {
                    id: 'test_' + Date.now(),
                    block_urls: blockUrl,
                    visited: "true",
                    used_time: timeUsed.toFixed(2),
                    time: timeUsed.toFixed(2),
                    temporary_time: timeUsed,
                    is_temporary: "true",
                    half_time_notified: "true",
                    one_quarter_notified: "true",
                    three_quarter_notified: "true"
                },
                timestamp: Date.now()
            }
        };

        // Send the simulated message
        if (typeof chrome !== 'undefined' && chrome.runtime) {
            try {
                await chrome.runtime.sendMessage(simulatedData);
                console.log('✅ Simulated blocked website message sent');
            } catch (error) {
                console.error('❌ Error sending simulated message:', error);
            }
        }
    }

    // Test WebSocket connection status
    async testWebSocketConnection() {
        console.log('🔍 Testing WebSocket connection...');
        
        try {
            // Try to get WebSocket service status
            const message = await chrome.runtime.sendMessage({
                type: 'GET_WEBSOCKET_STATUS'
            });
            
            console.log('📡 WebSocket Status:', message);
        } catch (error) {
            console.error('❌ WebSocket connection test failed:', error);
        }
    }

    // Monitor Options page updates
    monitorOptionsPage() {
        console.log('👀 Monitoring Options page for real-time updates...');
        console.log('Open the Options page (chrome-extension://[extension-id]/options.html) to see real-time updates');
        console.log('When a website gets blocked, you should see the UI update automatically');
    }

    // Show help information
    showHelp() {
        console.group('📖 WebSocket Tester Help');
        console.log('Available methods:');
        console.log('  - tester.initialize() - Initialize the tester');
        console.log('  - tester.simulateWebsiteBlocked("example.com", 5) - Simulate a blocked website');
        console.log('  - tester.testWebSocketConnection() - Test WebSocket connection');
        console.log('  - tester.monitorOptionsPage() - Monitor Options page updates');
        console.log('  - tester.showHelp() - Show this help');
        console.log('');
        console.log('To test:');
        console.log('1. Open the Options page');
        console.log('2. Add a website with a short time limit (e.g., 1 minute)');
        console.log('3. Visit that website and wait for the time limit');
        console.log('4. Watch the Options page update automatically when blocked');
        console.groupEnd();
    }
}

// Create global instance for easy testing
if (typeof window !== 'undefined') {
    window.webSocketTester = new WebSocketTester();
    
    // Auto-initialize
    window.webSocketTester.initialize();
    
    console.log('🚀 WebSocket Tester loaded! Type "webSocketTester.showHelp()" for usage instructions.');
} else if (typeof global !== 'undefined') {
    global.webSocketTester = new WebSocketTester();
}

export default WebSocketTester;