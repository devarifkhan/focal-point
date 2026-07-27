// Import the modules we've created
import { loadInitialState, setActiveTab, resetActiveTabStartTime, checkAndPerformDailyReset, resetAllUrls, handleUrlStateUpdate } from './modules/stateManager';
import { initializeTimeTracking } from './modules/timeTracker';
import { registerNavigationListeners } from './modules/navigationHandler'; 
import { registerMessageListeners } from './modules/messageHandler';
import { fetchUrls } from './modules/apiService';
import { setupNotificationListeners } from './modules/notificationHelper';
import { forceResetAllUrls, setupForceResetMenu } from './modules/forceReset';
import webSocketApiService from '../../services/WebSocketApiService.js';

// Initialize state and event listeners
async function initializeExtension() {
    console.log("Initializing background script with modular approach");
    
    // First load initial state from storage
    await loadInitialState();
    
    // Initialize WebSocket API service for real-time updates
    try {
        await webSocketApiService.initialize();
        console.log("WebSocket API service initialized successfully");
        
        // Set up WebSocket event listeners for real-time updates
        webSocketApiService.onUrlsUpdated((urls) => {
            console.log('Background: Received real-time URL list update:', urls.length, 'URLs');
            // URLs are automatically cached in the WebSocket service
        });
        
        webSocketApiService.onUrlUpdated((urlData) => {
            console.log('Background: Received real-time URL update:', urlData.id, 'visited:', urlData.visited);
            // Handle URL state changes in background
            handleUrlStateUpdate(urlData).catch(error => {
                console.error('Error handling URL state update in background:', error);
            });
        });
    } catch (error) {
        console.error("Failed to initialize WebSocket API service:", error);
    }
    
    // Set up force reset context menu
    setupForceResetMenu();
    
    // Check if a daily reset is due and perform it if needed
    await checkAndPerformDailyReset();
    
    // Register all event listeners
    registerNavigationListeners(fetchUrls);
    registerMessageListeners();
    
    // Set up notification listeners
    setupNotificationListeners();
    
    // Initialize time tracking
    const timeTracker = initializeTimeTracking();
    
    // Add tab activation listener to track active tab
    chrome.tabs.onActivated.addListener(async (activeInfo) => {
        try {
            const tab = await chrome.tabs.get(activeInfo.tabId);
            console.log("Tab activated:", tab.id, tab.url);
            
            // Store the new active tab
            setActiveTab(activeInfo.tabId);
            
            // Reset the time tracker's check time
            timeTracker.resetCheckTime();
            
            // Run an immediate check
            await timeTracker.checkTime();
        } catch (error) {
            console.error("Error in tab activation handler:", error);
        }
    });

    // Add tab update listener
    chrome.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
        if (changeInfo.status === "complete") {
            try {
                console.log("Tab updated:", tabId, tab.url);
                
                // Reset start time if this is the active tab
                if (tab.active) {
                    setActiveTab(tabId);
                    
                    // Reset the time tracker's check time
                    timeTracker.resetCheckTime();
                    
                    // Run an immediate check
                    await timeTracker.checkTime();
                }
            } catch (error) {
                console.error("Error in tab update handler:", error);
            }
        }
    });

    // Add tab removal listener
    chrome.tabs.onRemoved.addListener((tabId) => {
        console.log("Tab removed:", tabId);
        // Nothing special to do here since the activeTabId is managed in stateManager.js
    });

    // Add cleanup on extension unload
    chrome.runtime.onSuspend.addListener(() => {
        console.log("Extension being suspended, saving final state...");
        // Close WebSocket connections
        webSocketApiService.disconnect();
        // No explicit action needed here as each module handles its own state persistence
    });
    
    // Initialize the active tab
    try {
        const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
        if (tabs.length > 0) {
            setActiveTab(tabs[0].id);
        }
    } catch (error) {
        console.error("Error initializing active tab:", error);
    }
    
    // Set up periodic check for daily reset - check more frequently during testing
    setInterval(async () => {
        await checkAndPerformDailyReset();
    }, 1000 * 5); // Check every 5 seconds for testing
    
    // Add a listener for force reset (for testing)
    chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
        if (message.type === 'forceReset') {
            console.log("Manual force reset requested");
            forceResetAllUrls().then(count => {
                console.log(`Manual reset completed, reset ${count} URLs`);
                sendResponse({success: true, count});
                
                // Reload all tabs to reflect the unblocked status after 2 seconds
                setTimeout(() => {
                    chrome.tabs.query({}, (tabs) => {
                        tabs.forEach(tab => {
                            chrome.tabs.reload(tab.id);
                        });
                    });
                }, 2000);
            }).catch(error => {
                console.error("Error during manual reset:", error);
                sendResponse({success: false, error: error.message});
            });
            return true; // Indicates async response
        }
        
        // Handle WebSocket URL update notifications
        if (message.type === 'WEBSOCKET_URL_UPDATE') {
            console.log('Background: Received WebSocket URL update message');
            // Forward the message to all extension pages (options, popup, etc.)
            chrome.runtime.sendMessage({
                type: 'WEBSOCKET_URL_UPDATE',
                data: message.data
            }).catch(() => {
                // Ignore errors - pages may not be open
            });
            sendResponse({success: true});
            return true;
        }
        
        // Handle website blocked notifications
        if (message.type === 'WEBSITE_BLOCKED') {
            console.log('Background: Website became blocked:', message.data?.url?.block_urls);
            // Forward the blocked notification to all extension pages
            chrome.runtime.sendMessage({
                type: 'WEBSITE_BLOCKED',
                data: message.data
            }).catch(() => {
                // Ignore errors - pages may not be open
            });
            sendResponse({success: true});
            return true;
        }
        
        // Handle opening options page
        if (message.type === 'OPEN_OPTIONS_PAGE') {
            console.log("Opening options page");
            chrome.runtime.openOptionsPage();
            sendResponse({success: true});
            return true;
        }
        
        // Handle reloading options page
        if (message.type === 'RELOAD_OPTIONS_PAGE') {
            console.log("Background: Received reload request, forwarding to options page");
            // Forward message to options page
            chrome.runtime.sendMessage({
                type: 'RELOAD_OPTIONS_PAGE_REQUEST'
            }).catch((err) => {
                console.log('Background: Error forwarding reload message:', err);
            });
            sendResponse({success: true});
            return true;
        }
        
        // Handle reset notification states
        if (message.type === 'RESET_NOTIFICATION_STATES') {
            console.log('Background: Resetting notification states for:', message.blockUrl);
            (async () => {
                try {
                    const { resetNotificationStatesForUrl } = await import('./modules/stateManager');
                    const success = await resetNotificationStatesForUrl(message.blockUrl);
                    sendResponse({success});
                } catch (error) {
                    console.error('Error resetting notification states:', error);
                    sendResponse({success: false, error: error.message});
                }
            })();
            return true;
        }
        

    });
}

// Start the extension
initializeExtension().catch(error => {
    console.error("Error initializing extension:", error);
});

