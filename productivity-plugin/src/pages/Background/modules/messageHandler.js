import { normalizeUrl, compareUrls, createBlockRegex } from './urlUtils';
import redirectManager from './redirectManager';
import { fetchUrls, reset_Time } from './apiService';
import { cleanupUrlData, resetAllUrls, resetNotificationStatesForUrl } from './stateManager';
import { injectContentScript } from './timeTracker';

// Register all message listeners for the background script
export function registerMessageListeners() {
    chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
        console.log("Background received message:", message);
        
        // Messages can have different types to handle different actions
        switch (message.type) {
            case 'preserveTimeAfterUpdate':
            case 'PRESERVE_TIME_AFTER_UPDATE':
                handlePreserveTimeAfterUpdate(message, sendResponse);
                break;
            case 'forceReloadNotificationStates':
            case 'FORCE_RELOAD_NOTIFICATION_STATES':
                handleForceReloadNotificationStates(message, sendResponse);
                break;
            case 'setUrlBlockedState':
            case 'SET_URL_BLOCKED_STATE':
                handleSetUrlBlockedState(message, sendResponse);
                break;
            case 'temporaryTimeReset':
            case 'TEMPORARY_TIME_RESET':
                handleTemporaryTimeReset(message, sendResponse);
                break;
            case 'resumeTimeTracking':
            case 'RESUME_TIME_TRACKING':
                handleResumeTimeTracking(message, sendResponse);
                break;
            case 'manualResetAll':
            case 'MANUAL_RESET_ALL':
                handleManualResetAll(message, sendResponse);
                break;
            case 'updateResetConfig':
            case 'UPDATE_RESET_CONFIG':
                handleUpdateResetConfig(message, sendResponse);
                break;
            case 'forceTimeReset':
            case 'FORCE_TIME_RESET':
                handleForceTimeReset(message, sendResponse);
                break;
            case 'cleanupUrlData':
            case 'CLEANUP_URL_DATA':
                handleCleanupUrlData(message, sendResponse);
                break;
            case 'forceRefreshUrlState':
            case 'FORCE_REFRESH_URL_STATE':
                handleForceRefreshUrlState(message, sendResponse);
                break;
            case 'resetNotificationStates':
            case 'RESET_NOTIFICATION_STATES':
                handleResetNotificationStates(message, sendResponse);
                break;
            case 'urlBlockedUpdate':
            case 'URL_BLOCKED_UPDATE':
                handleUrlBlockedUpdate(message, sendResponse);
                break;
            case 'localUrlAdded':
            case 'LOCAL_URL_ADDED':
                handleLocalUrlAdded(message, sendResponse);
                break;
            default:
                console.log("Unknown message type:", message.type);
                sendResponse({ success: false, error: "Unknown message type" });
        }
        
        // Return true to indicate we'll respond asynchronously
        return true;
    });
}

// Handle preserving time after URL update
async function handlePreserveTimeAfterUpdate(message, sendResponse) {
    try {
        // Import needed modules on-demand to avoid circular dependencies
        const { urlAccumulatedTimes, notificationStates } = await import('./stateManager');
        const { setState } = await import('./storage');
        
        const normalizedUrl = normalizeUrl(message.url);
        const shouldResetTime = message.shouldResetTime;
        
        console.log(`Received PRESERVE_TIME_AFTER_UPDATE for ${normalizedUrl}, shouldReset=${shouldResetTime}`);
        
        // Always reset notification states when time limit changes to allow proper recalculation
        if (message.notificationStates) {
            console.log(`Resetting notification states for ${normalizedUrl} due to time limit change`);
            
            notificationStates[normalizedUrl] = {
                halfTimeShown: false,
                oneQuarterShown: false,
                threeQuarterShown: false
            };
            
            // Save the updated notification states
            setState('blockerNotificationStates', notificationStates)
                .then(() => {
                    console.log(`Reset notification states saved for ${normalizedUrl}`);
                })
                .catch(error => {
                    console.error(`Error saving notification states for ${normalizedUrl}:`, error);
                });
        }
        
        if (!shouldResetTime && urlAccumulatedTimes[normalizedUrl]) {
            // We need to ensure the in-memory time is preserved
            console.log(`Explicitly preserving time for ${normalizedUrl}: ${urlAccumulatedTimes[normalizedUrl]}`);
            
            // Make sure we store the current value again to avoid race conditions with other updates
            setState('blockerUrlAccumulatedTimes', urlAccumulatedTimes)
                .then(() => {
                    console.log(`Preserved accumulated time saved for ${normalizedUrl}`);
                    sendResponse({ success: true });
                })
                .catch(error => {
                    console.error(`Error saving preserved time for ${normalizedUrl}:`, error);
                    sendResponse({ success: false, error: error.message });
                });
        } else {
            sendResponse({ success: true });
        }
    } catch (error) {
        console.error("Error in handlePreserveTimeAfterUpdate:", error);
        sendResponse({ success: false, error: error.message });
    }
}

// Handle force reload notification states
async function handleForceReloadNotificationStates(message, sendResponse) {
    try {
        // Import needed modules on-demand
        const { notificationStates } = await import('./stateManager');
        const { getState } = await import('./storage');
        
        const normalizedUrl = normalizeUrl(message.url);
        
        console.log(`Forcing reload of notification states for ${normalizedUrl}`);
        
        // Reload all notification states from storage
        getState('blockerNotificationStates', {}).then(states => {
            if (states[normalizedUrl]) {
                console.log(`Loaded storage notification states for ${normalizedUrl}:`, states[normalizedUrl]);
                // Update the in-memory state
                notificationStates[normalizedUrl] = states[normalizedUrl];
                console.log(`Updated in-memory notification states:`, notificationStates[normalizedUrl]);
            } else {
                console.log(`No notification states found in storage for ${normalizedUrl}`);
                // Initialize with defaults if not found
                notificationStates[normalizedUrl] = {
                    halfTimeShown: false,
                    oneQuarterShown: false,
                    threeQuarterShown: false
                };
                console.log(`Set default notification states:`, notificationStates[normalizedUrl]);
            }
            
            sendResponse({ success: true });
        }).catch(error => {
            console.error(`Error reloading notification states for ${normalizedUrl}:`, error);
            sendResponse({ success: false, error: error.message });
        });
    } catch (error) {
        console.error("Error in handleForceReloadNotificationStates:", error);
        sendResponse({ success: false, error: error.message });
    }
}

// Handle set URL blocked state
async function handleSetUrlBlockedState(message, sendResponse) {
    try {
        // Import needed modules on-demand
        const { getBlockedUrlsFromStorage } = await import('./storage');
        const { handleUrlStateUpdate } = await import('./stateManager');
        const { normalizeUrl } = await import('./urlUtils');
        
        getBlockedUrlsFromStorage().then(async (blockedUrls) => {
            const urlIndex = blockedUrls.findIndex(url => 
                normalizeUrl(url.block_urls) === normalizeUrl(message.url)
            );
            
            if (urlIndex !== -1) {
                // Update the URL's visited state
                blockedUrls[urlIndex].visited = message.blocked.toString();
                
                // Save back to storage
                await new Promise((resolve) => {
                    chrome.storage.local.set({ 'blocked_urls': blockedUrls }, resolve);
                });

                // Handle URL state update
                await handleUrlStateUpdate(blockedUrls[urlIndex]);
                
                sendResponse({ success: true });
            } else {
                sendResponse({ success: false, error: 'URL not found' });
            }
        }).catch(error => {
            console.error("Error setting URL blocked state:", error);
            sendResponse({ success: false, error: error.message });
        });
    } catch (error) {
        console.error("Error in handleSetUrlBlockedState:", error);
        sendResponse({ success: false, error: error.message });
    }
}

// Handle temporary time reset
async function handleTemporaryTimeReset(message, sendResponse) {
    try {
        // Import needed modules on-demand
        const { urlTimes, urlAccumulatedTimes, notificationStates, accumulatedTime, accumulatedActiveTime, resetActiveTabStartTime } = await import('./stateManager');
        const { setState } = await import('./storage');
        const { getBlockedUrlsFromStorage } = await import('./storage');
        
        const normalizedUrl = normalizeUrl(message.url);
        console.log(`Received TEMPORARY_TIME_RESET message for ${normalizedUrl}`);
        
        // Force reset of all time tracking for temporary time in memory
        urlTimes[normalizedUrl] = 0;
        urlAccumulatedTimes[normalizedUrl] = 0;
        if (accumulatedTime[normalizedUrl]) {
            accumulatedTime[normalizedUrl] = 0;
        }
        if (accumulatedActiveTime[normalizedUrl]) {
            accumulatedActiveTime[normalizedUrl] = 0;
        }

        // Reset notification states
        notificationStates[normalizedUrl] = {
            halfTimeShown: false,
            oneQuarterShown: false,
            threeQuarterShown: false
        };

        // Reset active tab start time if we're tracking this URL
        resetActiveTabStartTime();

        // Also update the blocked_urls in storage to ensure time is reset there too
        try {
            const blockedUrls = await getBlockedUrlsFromStorage();
            const urlIndex = blockedUrls.findIndex(url => normalizeUrl(url.block_urls) === normalizedUrl);
            
            if (urlIndex !== -1) {
                // Reset the URL data in storage but preserve the time limits
                blockedUrls[urlIndex].time = "0.0";
                blockedUrls[urlIndex].visited = "false";
                blockedUrls[urlIndex].half_time_notified = "false";
                blockedUrls[urlIndex].one_quarter_notified = "false";
                blockedUrls[urlIndex].three_quarter_notified = "false";
                // Don't reset temporary_time, default_time, or today_limit as they should preserve the updated values
                
                // Save back to storage
                await new Promise(resolve => {
                    chrome.storage.local.set({ 'blocked_urls': blockedUrls }, resolve);
                });
                console.log(`Reset time in blocked_urls storage for ${normalizedUrl}`);
            }
        } catch (storageError) {
            console.error(`Error updating blocked_urls storage: ${storageError}`);
        }

        // Save all changes to storage
        Promise.all([
            setState('blockerUrlTimes', urlTimes),
            setState('blockerUrlAccumulatedTimes', urlAccumulatedTimes),
            setState('blockerNotificationStates', notificationStates)
        ]).then(() => {
            console.log(`Successfully reset all time tracking for temporary URL: ${normalizedUrl}`);
            sendResponse({success: true});
        }).catch(error => {
            console.error(`Error resetting time tracking: ${error}`);
            sendResponse({success: false, error: error.message});
        });
    } catch (error) {
        console.error("Error in handleTemporaryTimeReset:", error);
        sendResponse({ success: false, error: error.message });
    }
}

// Handle resume time tracking message
async function handleResumeTimeTracking(message, sendResponse) {
    try {
        // Import the time tracker controller
        const { getTimeTrackerController } = await import('./timeTracker');
        
        console.log("Received request to resume time tracking from warning page");
        
        // Get the time tracker controller
        const timeTracker = getTimeTrackerController();
        
        // Check if time tracking is paused
        if (timeTracker && timeTracker.isPaused()) {
            // Get the pause reason
            const pauseReason = timeTracker.getPauseReason();
            
            // Only resume if paused due to warning page or notification
            if (pauseReason === "warning_page_75" || pauseReason === "warning_page" || pauseReason.includes("notification")) {
                // Resume time tracking
                timeTracker.setPaused(false);
                timeTracker.resetCheckTime();
                console.log("Time tracking resumed after warning page closed");
                
                sendResponse({ success: true, message: "Time tracking resumed" });
            } else {
                console.log(`Time tracking not resumed because pause reason was: ${pauseReason}`);
                sendResponse({ success: false, error: "Time tracking paused for another reason" });
            }
        } else {
            console.log("Time tracking was not paused, nothing to resume");
            sendResponse({ success: true, message: "Time tracking was not paused" });
        }
    } catch (error) {
        console.error("Error in handleResumeTimeTracking:", error);
        sendResponse({ success: false, error: error.message });
    }
}

// Handle manual reset of all URLs
async function handleManualResetAll(message, sendResponse) {
    try {
        console.log("Handling manual reset of all URLs");
        
        // Call the function to reset all URLs
        const resetCount = await resetAllUrls();
        
        // Send success response
        sendResponse({ 
            success: true, 
            message: `Successfully reset ${resetCount} URLs.`,
            resetCount
        });
    } catch (error) {
        console.error("Error handling manual reset:", error);
        sendResponse({ 
            success: false, 
            error: error.message || "Unknown error during reset"
        });
    }
}

// Handle update to reset configuration
async function handleUpdateResetConfig(message, sendResponse) {
    try {
        const { config } = message;
        console.log("Updating reset configuration:", config);
        
        // Validate configuration
        if (typeof config.enabled !== 'boolean') {
            throw new Error("Invalid configuration: 'enabled' must be a boolean");
        }
        
        if (!['daily', 'weekly', 'monthly'].includes(config.frequency)) {
            throw new Error("Invalid configuration: 'frequency' must be 'daily', 'weekly', or 'monthly'");
        }
        
        if (config.frequency === 'weekly' && (typeof config.dayOfWeek !== 'number' || config.dayOfWeek < 0 || config.dayOfWeek > 6)) {
            throw new Error("Invalid configuration: 'dayOfWeek' must be a number between 0 and 6");
        }
        
        if (config.frequency === 'monthly' && (typeof config.dayOfMonth !== 'number' || config.dayOfMonth < 1 || config.dayOfMonth > 31)) {
            throw new Error("Invalid configuration: 'dayOfMonth' must be a number between 1 and 31");
        }
        
        // Save the configuration
        await new Promise(resolve => {
            chrome.storage.local.set({ 'resetConfig': config }, resolve);
        });
        
        // Send success response
        sendResponse({ 
            success: true, 
            message: "Reset configuration updated successfully",
            config
        });
    } catch (error) {
        console.error("Error updating reset configuration:", error);
        sendResponse({ 
            success: false, 
            error: error.message || "Unknown error updating reset configuration"
        });
    }
}

// Handle force time reset - for immediate testing of reset functionality
async function handleForceTimeReset(message, sendResponse) {
    try {
        const { resetAllUrls } = await import('./stateManager');
        
        console.log("Force resetting all URL times");
        const resetCount = await resetAllUrls();
        
        sendResponse({
            success: true,
            message: `Force reset completed. Reset ${resetCount} URLs.`,
            resetCount
        });
    } catch (error) {
        console.error("Error during force reset:", error);
        sendResponse({
            success: false,
            error: error.message || "Unknown error during force reset"
        });
    }
}

// Handle URL data cleanup message
async function handleCleanupUrlData(message, sendResponse) {
    try {
        if (!message.blockUrl) {
            throw new Error("No URL provided for cleanup");
        }
        
        console.log("Cleaning up URL data for:", message.blockUrl);
        
        // Import the cleanupUrlData function from stateManager
        const { cleanupUrlData } = await import('./stateManager');
        
        // Perform the cleanup
        await cleanupUrlData(message.blockUrl);
        
        // After successful cleanup, reload all tabs that might be showing this URL after 2 seconds
        try {
            chrome.tabs.query({}, (tabs) => {
                const tabsToReload = [];
                for (const tab of tabs) {
                    if (tab.url && tab.url.includes(message.blockUrl)) {
                        console.log(`Will reload tab ${tab.id} in 2 seconds to reflect cleanup changes`);
                        tabsToReload.push(tab.id);
                    }
                }
                
                if (tabsToReload.length > 0) {
                    setTimeout(() => {
                        tabsToReload.forEach(tabId => {
                            console.log(`Reloading tab ${tabId} to reflect cleanup changes`);
                            chrome.tabs.reload(tabId);
                        });
                    }, 2000);
                }
            });
        } catch (reloadError) {
            console.warn("Error reloading tabs after cleanup:", reloadError);
        }
        
        // Notify all tabs that URL list has been updated
        chrome.runtime.sendMessage({
            type: 'URL_BLOCKED_UPDATE'
        }).catch(err => console.warn("Error broadcasting URL update:", err));
        
        sendResponse({ success: true, message: `Successfully cleaned up data for ${message.blockUrl}` });
    } catch (error) {
        console.error("Error during URL cleanup:", error);
        sendResponse({ 
            success: false, 
            error: error.message || "Unknown error during cleanup"
        });
    }
}

// Handle force refresh URL state message
async function handleForceRefreshUrlState(message, sendResponse) {
    try {
        const { fetchUrls } = await import('./apiService');
        const { urlAccumulatedTimes, notificationStates } = await import('./stateManager');
        const { normalizeUrl } = await import('./urlUtils');
        
        console.log(`Force refreshing URL state for: ${message.url}`);
        
        // Force refresh the URLs from API/storage
        await fetchUrls(true); // Force refresh
        
        const normalizedUrl = normalizeUrl(message.url);
        
        // Reset notification states to allow proper recalculation
        if (notificationStates[normalizedUrl]) {
            console.log(`Resetting notification states for ${normalizedUrl}`);
            notificationStates[normalizedUrl] = {
                halfTimeShown: false,
                oneQuarterShown: false,
                threeQuarterShown: false
            };
        }
        
        sendResponse({ success: true, message: `URL state refreshed for ${message.url}` });
    } catch (error) {
        console.error("Error during force refresh URL state:", error);
        sendResponse({ 
            success: false, 
            error: error.message || "Unknown error during force refresh"
        });
    }
}

// Handle reset notification states message
async function handleResetNotificationStates(message, sendResponse) {
    try {
        const { resetNotificationStatesForUrl } = await import('./stateManager');
        
        if (!message.blockUrl) {
            throw new Error("No URL provided for notification reset");
        }
        
        console.log(`Resetting notification states for: ${message.blockUrl}`);
        
        // Reset notification states for the URL
        const success = await resetNotificationStatesForUrl(message.blockUrl);
        
        if (success) {
            sendResponse({ 
                success: true, 
                message: `Notification states reset for ${message.blockUrl}` 
            });
        } else {
            sendResponse({ 
                success: false, 
                error: "Failed to reset notification states" 
            });
        }
    } catch (error) {
        console.error("Error during notification states reset:", error);
        sendResponse({ 
            success: false, 
            error: error.message || "Unknown error during notification reset"
        });
    }
}

// Handle URL blocked update message
async function handleUrlBlockedUpdate(message, sendResponse) {
    try {
        console.log("Handling URL blocked update notification");
        // This is just a notification message, no action needed
        sendResponse({ success: true });
    } catch (error) {
        console.error("Error handling URL blocked update:", error);
        sendResponse({ success: false, error: error.message });
    }
}

// Handle local URL added message
async function handleLocalUrlAdded(message, sendResponse) {
    try {
        console.log("Handling local URL added notification:", message.url);
        // This is just a notification message, no action needed
        sendResponse({ success: true });
    } catch (error) {
        console.error("Error handling local URL added:", error);
        sendResponse({ success: false, error: error.message });
    }
}