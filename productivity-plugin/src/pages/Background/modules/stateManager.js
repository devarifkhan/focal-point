import { normalizeUrl, compareUrls } from './urlUtils';
import { STORAGE_KEYS, getState, setState, saveMapToStorage, getAccessToken } from './storage';
import redirectManager from './redirectManager';
import { handleTimeLimit } from './timeTracker';

// Global state tracking variables - these will be imported by index.js
export let urlTimes = {};
export let urlAccumulatedTimes = {};
export let notificationStates = {};
export let urlStateTransitions = new Map();
export let tabTimes = {};
export let accumulatedTime = {};
export let accumulatedActiveTime = {};

// Helper function to check if state has changed significantly
function hasStateChanged(oldState, newState) {
    if (!oldState) return true;

    // Check for significant state changes
    return (
        oldState.visited !== newState.visited ||
        oldState.time !== newState.time ||
        Math.abs(oldState.time - newState.time) > 0.01 || // Handle floating point comparison
        oldState.is_temporary !== newState.is_temporary
    );
}

// Function to handle URL state updates
export async function handleUrlStateUpdate(urlData, isFromSync = false) {
    try {
        // Check if there is a previous state of this URL in transitions map
        const previousState = urlStateTransitions.get(urlData.block_urls);
        
        // First update the transitions map with the new state
        urlStateTransitions.set(urlData.block_urls, urlData);
        
        console.log(`URL state update for ${urlData.block_urls}:`, 
            previousState ? `Previous: visited=${previousState.visited}, time=${previousState.time}` : 'No previous state',
            `Current: visited=${urlData.visited}, time=${urlData.time}`,
            isFromSync ? '(from sync)' : '(real-time)');
        
        // Check if visited state has changed from false to true (URL just became blocked)
        // Only trigger blocking if this is NOT from a sync operation and there was a clear previous state
        if (urlData.visited === "true" && previousState?.visited !== "true" && !isFromSync && previousState) {
            console.log(`URL ${urlData.block_urls} is newly blocked, handling block for all matching tabs`);
            
            // Import the blockAllMatchingTabs function
            const { blockAllMatchingTabs } = await import('./navigationHandler');
            
            // Get all tabs
            const allTabs = await chrome.tabs.query({});
            
            // Create block pattern for URL
            const blockPattern = createBlockRegex(urlData.block_urls);
            
            // Find and handle matching tabs
            const matchingTabs = allTabs.filter(tab => blockPattern.test(tab.url));
            if (matchingTabs.length > 0) {
                console.log(`Found ${matchingTabs.length} tabs matching ${urlData.block_urls} to block`);
                
                // Block all matching tabs
                await blockAllMatchingTabs(urlData.block_urls, urlData);
            }
        } else if (urlData.visited === "true" && isFromSync) {
            console.log(`URL ${urlData.block_urls} is blocked from server sync - not triggering real-time block`);
        }
        
        // When server says site is unblocked, accept this state and unblock locally if needed
        if (urlData.visited === "false" && previousState?.visited === "true" && !isFromSync) {
            console.log(`Server says ${urlData.block_urls} is now unblocked, accepting server state`);
            // The unblock logic below will handle reloading tabs
        }
        
        // Check if visited state has changed from true to false (URL just became unblocked)
        if (urlData.visited === "false" && previousState?.visited === "true") {
            console.log(`URL ${urlData.block_urls} is newly unblocked, reloading all matching tabs in 2 seconds`);
            
            // Get all tabs
            const allTabs = await chrome.tabs.query({});
            
            // Create block pattern for URL
            const blockPattern = createBlockRegex(urlData.block_urls);
            
            // Find and reload matching tabs after 2 seconds
            const matchingTabs = allTabs.filter(tab => blockPattern.test(tab.url));
            if (matchingTabs.length > 0) {
                console.log(`Found ${matchingTabs.length} tabs matching ${urlData.block_urls} to reload in 2 seconds`);
                
                // Wait 2 seconds before reloading tabs
                setTimeout(() => {
                    matchingTabs.forEach(tab => {
                        console.log(`Reloading tab ${tab.id} to remove block page for ${urlData.block_urls}`);
                        chrome.tabs.reload(tab.id);
                    });
                }, 2000);
            }
        }
        
        // Time limit reached transition
        if (previousState && urlData.time >= urlData.minutes_to_unblock && previousState.time < previousState.minutes_to_unblock) {
            // Check first if we already have a recent redirect
            if (await redirectManager.hasRecentRedirect(urlData.block_urls)) {
                console.log("Skipping time limit action in handleUrlStateUpdate because recent redirect exists:", urlData.block_urls);
            } else {
                console.log(`Time limit reached on ${urlData.block_urls}, triggering redirect`);
                
                // Import and call handleTimeLimit
                const { handleTimeLimit } = await import('./timeTracker');
                const redirectUrl = urlData.redirect_urls?.startsWith("http")
                    ? urlData.redirect_urls
                    : `https://www.${urlData.redirect_urls?.replace(/^www\./, "") || ""}`;
                
                await handleTimeLimit(redirectUrl, urlData, normalizeUrl(urlData.block_urls));
                
                // Also sync visited=true to server if not already done
                if (urlData.visited !== "true" && !isFromSync) {
                    try {
                        const webSocketApiService = (await import('../../../services/WebSocketApiService.js')).default;
                        await webSocketApiService.updateUrl(urlData.id, {
                            visited: "true"
                        });
                        console.log(`Synced visited=true to server after time limit reached for ${urlData.block_urls}`);
                    } catch (syncError) {
                        console.error(`Failed to sync visited state after time limit for ${urlData.block_urls}:`, syncError);
                    }
                }
            }
        }
        
    } catch (error) {
        console.error("Error in handleUrlStateUpdate:", error);
    }
}



// Reset state for a URL
export async function resetUrlState(normalizedUrl) {
    // Reset all time tracking
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
        threeQuarterShown: false,
    };
    
    // Reset state transitions
    const currentState = urlStateTransitions.get(normalizedUrl);
    if (currentState) {
        currentState.visited = false;
        currentState.time = 0;
        currentState.half_time_notified = false;
        currentState.one_quarter_notified = false;
        currentState.three_quarter_notified = false;
        urlStateTransitions.set(normalizedUrl, currentState);
    }
    
    // Save to Chrome Storage
    await setState(STORAGE_KEYS.URL_TIMES, urlTimes);
    await setState(STORAGE_KEYS.URL_ACCUMULATED_TIMES, urlAccumulatedTimes);
    await setState(STORAGE_KEYS.NOTIFICATION_STATES, notificationStates);
    await saveMapToStorage(urlStateTransitions, STORAGE_KEYS.URL_STATE_TRANSITIONS);
}

// Reset notification states for a URL when it's re-added after deletion
export async function resetNotificationStatesForUrl(blockUrl) {
    try {
        const normalizedUrl = normalizeUrl(blockUrl);
        console.log(`Resetting notification states for re-added URL: ${blockUrl} (normalized: ${normalizedUrl})`);
        
        // Clear base time cache for this URL
        try {
            const { clearBaseTimeCache } = await import('./timeTracker');
            clearBaseTimeCache(blockUrl);
            clearBaseTimeCache(normalizedUrl);
        } catch (error) {
            console.warn('Could not clear base time cache for URL:', error);
        }
        
        // Create URL variations to ensure complete reset
        const urlVariations = [
            blockUrl,
            normalizedUrl,
            blockUrl.replace(/^https?:\/\/(www\.)?/, ''),
            normalizedUrl.replace(/^https?:\/\/(www\.)?/, ''),
        ].filter(url => url && url.length > 0);
        
        // Reset in-memory notification states for all variations
        urlVariations.forEach(variation => {
            notificationStates[variation] = {
                halfTimeShown: false,
                oneQuarterShown: false,
                threeQuarterShown: false,
            };
            
            // Also reset time tracking to ensure fresh start
            urlTimes[variation] = 0;
            urlAccumulatedTimes[variation] = 0;
            if (accumulatedTime[variation]) {
                accumulatedTime[variation] = 0;
            }
            if (accumulatedActiveTime[variation]) {
                accumulatedActiveTime[variation] = 0;
            }
            
            // Clear from URL state transitions
            urlStateTransitions.delete(variation);
        });
        
        // Also reset notification states in blocked_urls storage
        try {
            const result = await new Promise(resolve => {
                chrome.storage.local.get('blocked_urls', resolve);
            });
            
            if (result.blocked_urls) {
                const updatedUrls = result.blocked_urls.map(url => {
                    if (urlVariations.some(variation => compareUrls(url.block_urls, variation))) {
                        return {
                            ...url,
                            half_time_notified: "false",
                            one_quarter_notified: "false", 
                            three_quarter_notified: "false",
                            time: "0.00",
                            used_time: "0.00"
                        };
                    }
                    return url;
                });
                
                await new Promise(resolve => {
                    chrome.storage.local.set({ 'blocked_urls': updatedUrls }, resolve);
                });
                console.log(`Reset notification states in blocked_urls storage for: ${blockUrl}`);
            }
        } catch (storageError) {
            console.warn("Error resetting notification states in storage:", storageError);
        }
        
        // Save to storage
        await setState(STORAGE_KEYS.NOTIFICATION_STATES, notificationStates);
        await setState(STORAGE_KEYS.URL_TIMES, urlTimes);
        await setState(STORAGE_KEYS.URL_ACCUMULATED_TIMES, urlAccumulatedTimes);
        await saveMapToStorage(urlStateTransitions, STORAGE_KEYS.URL_STATE_TRANSITIONS);
        
        console.log(`Notification states reset completed for: ${blockUrl}`);
        return true;
    } catch (error) {
        console.error("Error resetting notification states:", error);
        return false;
    }
}

// Comprehensive cleanup for a URL
export async function cleanupUrlData(blockUrl) {
    try {
        const normalizedUrl = normalizeUrl(blockUrl);
        console.log(`Performing comprehensive cleanup for URL: ${blockUrl} (normalized: ${normalizedUrl})`);

        // Clear base time cache for this URL
        try {
            const { clearBaseTimeCache } = await import('./timeTracker');
            clearBaseTimeCache(blockUrl);
            clearBaseTimeCache(normalizedUrl);
        } catch (error) {
            console.warn('Could not clear base time cache for URL:', error);
        }

        // Create a URL pattern for thorough cleanup
        const urlPattern = createBlockRegex(blockUrl);
        
        // Mark this URL for notification state reset if it gets re-added
        redirectManager.markForNotificationReset(blockUrl);
        redirectManager.markForNotificationReset(normalizedUrl);
        
        // Create comprehensive URL variations for cleanup
        const urlVariations = [
            blockUrl,
            normalizedUrl,
            blockUrl.replace(/^https?:\/\/(www\.)?/, ''),
            normalizedUrl.replace(/^https?:\/\/(www\.)?/, ''),
            blockUrl.replace(/^https?:\/\//, ''),
            normalizedUrl.replace(/^https?:\/\//, ''),
            blockUrl.replace(/\/$/, ''),
            normalizedUrl.replace(/\/$/, ''),
            `https://${blockUrl.replace(/^https?:\/\/(www\.)?/, '')}`,
            `http://${blockUrl.replace(/^https?:\/\/(www\.)?/, '')}`,
            `www.${blockUrl.replace(/^https?:\/\/(www\.)?/, '')}`,
        ];
        
        // Remove duplicates and empty strings
        const uniqueVariations = [...new Set(urlVariations.filter(v => v && v.length > 0))];
        
        uniqueVariations.forEach(variation => {
            redirectManager.markForNotificationReset(variation);
        });
        
        // Get all relevant data from storage
        const result = await new Promise(resolve => {
            chrome.storage.local.get([
                'blocked_urls',
                'blockerUrlTimes',
                'blockerUrlAccumulatedTimes', 
                'blockerNotificationStates',
                'blockerUrlStateTransitions',
                'blockerTabTimes',
                'redirectManagerData',
                'redirectManagerCounts',
                'lastResetTime',
                'resetConfig'
            ], resolve);
        });
        
        // Prepare changes object
        const changes = {};
        
        // 1. Remove from blocked_urls array
        if (result.blocked_urls) {
            const originalLength = result.blocked_urls.length;
            changes.blocked_urls = result.blocked_urls.filter(url => {
                // Check against all URL variations
                return !uniqueVariations.some(variation => 
                    compareUrls(url.block_urls, variation) || 
                    url.block_urls === variation ||
                    urlPattern.test(url.block_urls)
                );
            });
            console.log(`Removed ${originalLength - changes.blocked_urls.length} entries from blocked_urls`);
        }
        
        // 2. Handle key-value objects where URL is the key - comprehensive cleanup
        const objectStorageKeys = ['blockerNotificationStates', 'blockerUrlAccumulatedTimes', 'blockerUrlTimes', 'blockerUrlStateTransitions'];
        for (const storageKey of objectStorageKeys) {
            if (result[storageKey]) {
                // Create a copy of the object
                changes[storageKey] = {...result[storageKey]};
                
                let removedCount = 0;
                for (const key in changes[storageKey]) {
                    // Check against all URL variations and patterns
                    const shouldRemove = uniqueVariations.some(variation => 
                        key === variation || 
                        compareUrls(key, variation) ||
                        urlPattern.test(key) ||
                        key.includes(variation) ||
                        variation.includes(key)
                    );
                    
                    if (shouldRemove) {
                        delete changes[storageKey][key];
                        removedCount++;
                        console.log(`Removing ${key} from ${storageKey}`);
                    }
                }
                console.log(`Removed ${removedCount} entries from ${storageKey}`);
            }
        }
        
        // 3. Handle redirect manager data - more thorough cleanup
        if (result.redirectManagerData) {
            changes.redirectManagerData = {...result.redirectManagerData};
            let redirectsRemoved = 0;
            
            for (const key in changes.redirectManagerData) {
                // Check for keys containing any URL variation
                const shouldRemove = uniqueVariations.some(variation => 
                    key.includes(variation) || 
                    variation.includes(key) ||
                    compareUrls(key, variation)
                );
                
                if (shouldRemove) {
                    delete changes.redirectManagerData[key];
                    redirectsRemoved++;
                    console.log(`Removing redirect data for key: ${key}`);
                }
            }
            
            console.log(`Removed ${redirectsRemoved} entries from redirectManagerData`);
        }
        
        // 4. Clean up redirect counts - check all variations
        if (result.redirectManagerCounts) {
            changes.redirectManagerCounts = {...result.redirectManagerCounts};
            let countsRemoved = 0;
            
            uniqueVariations.forEach(variation => {
                if (changes.redirectManagerCounts[variation]) {
                    delete changes.redirectManagerCounts[variation];
                    countsRemoved++;
                    console.log(`Removed redirect count for: ${variation}`);
                }
            });
            
            console.log(`Removed ${countsRemoved} entries from redirectManagerCounts`);
        }
        
        // 5. Clear from in-memory variables - comprehensive cleanup
        uniqueVariations.forEach(variation => {
            delete urlTimes[variation];
            delete urlAccumulatedTimes[variation];
            delete notificationStates[variation];
            delete accumulatedTime[variation];
            delete accumulatedActiveTime[variation];
            urlStateTransitions.delete(variation);
            redirectManager.redirectedUrls.delete(variation);
            redirectManager.locks.delete(variation);
        });
        
        // Also clear any tab-specific time tracking
        if (tabTimes) {
            Object.keys(tabTimes).forEach(tabId => {
                if (tabTimes[tabId] && uniqueVariations.some(variation => 
                    tabTimes[tabId].url && compareUrls(tabTimes[tabId].url, variation)
                )) {
                    delete tabTimes[tabId];
                    console.log(`Cleared tab time tracking for tab ${tabId}`);
                }
            });
        }
        
        // 6. Save all changes to storage
        await new Promise(resolve => {
            chrome.storage.local.set(changes, resolve);
        });
        
        // 7. Force clear any remaining notification states in storage
        try {
            const notificationResult = await new Promise(resolve => {
                chrome.storage.local.get('blockerNotificationStates', resolve);
            });
            
            if (notificationResult.blockerNotificationStates) {
                const cleanedNotifications = {...notificationResult.blockerNotificationStates};
                let additionalCleared = 0;
                
                Object.keys(cleanedNotifications).forEach(key => {
                    if (uniqueVariations.some(variation => 
                        key.includes(variation) || variation.includes(key) || compareUrls(key, variation)
                    )) {
                        delete cleanedNotifications[key];
                        additionalCleared++;
                    }
                });
                
                if (additionalCleared > 0) {
                    await new Promise(resolve => {
                        chrome.storage.local.set({ 'blockerNotificationStates': cleanedNotifications }, resolve);
                    });
                    console.log(`Additional cleanup: removed ${additionalCleared} notification states`);
                }
            }
        } catch (notificationError) {
            console.warn("Error during additional notification cleanup:", notificationError);
        }
        
        console.log(`Comprehensive cleanup for ${blockUrl} completed with ${uniqueVariations.length} URL variations checked`);
        return true;
    } catch (error) {
        console.error("Error during comprehensive cleanup:", error);
        throw error;
    }
}

// Initialize all states from storage
export async function loadInitialState() {
    tabTimes = await getState(STORAGE_KEYS.TAB_TIMES, {});
    urlTimes = await getState(STORAGE_KEYS.URL_TIMES, {});
    urlAccumulatedTimes = await getState(STORAGE_KEYS.URL_ACCUMULATED_TIMES, {});
    notificationStates = await getState(STORAGE_KEYS.NOTIFICATION_STATES, {});

    // Convert object to Map for state transitions
    const stateTransitions = await getState(STORAGE_KEYS.URL_STATE_TRANSITIONS, {});
    urlStateTransitions = new Map(Object.entries(stateTransitions));
    
    // Restore accumulated time from storage to maintain state across login/logout
    Object.assign(accumulatedTime, urlAccumulatedTimes);
    Object.assign(accumulatedActiveTime, urlAccumulatedTimes);
    
    // Clear any stale base time cache on startup to ensure fresh calculations
    try {
        await new Promise(resolve => {
            chrome.storage.local.remove(['originalBaseTimeCache', 'todayLimitCache'], resolve);
        });
        console.log('Cleared stale base time cache on startup');
    } catch (error) {
        console.warn('Could not clear base time cache on startup:', error);
    }
    
    console.log("Initial state loaded:", tabTimes, urlTimes, urlAccumulatedTimes, notificationStates, urlStateTransitions);
    console.log("Restored accumulated time:", accumulatedTime, accumulatedActiveTime);
}

// Reset all URLs for both local and cloud users
export async function resetAllUrls() {
    try {
        const { getAccessToken } = await import('./storage');
        const token = await getAccessToken();
        
        if (token) {
            // Cloud user - use API reset
            const { resetAllUrlsCloud } = await import('./apiService');
            const result = await resetAllUrlsCloud();
            console.log("Cloud reset completed:", result);
            
            // Ensure timestamp is saved (apiService should handle this, but double-check)
            const resetTimestamp = Date.now();
            await setState('lastResetTime', resetTimestamp);
            
            return result.data?.reset_count || 0;
        } else {
            // Local user - use local reset (this already saves timestamp)
            return await scheduledResetAllUrlsLocal();
        }
    } catch (error) {
        console.error("Error in resetAllUrls:", error);
        throw error;
    }
}

// Scheduled reset of all URLs - only affects local storage
export async function scheduledResetAllUrlsLocal() {
    try {
        console.log("Starting scheduled reset of all URLs in local storage");
        
        // Clear additionalTime cache to reset additionalTime to 0
        try {
            const { clearBaseTimeCache } = await import('./timeTracker');
            clearBaseTimeCache(); // Clear all cache
            
            // Also clear from storage
            await new Promise(resolve => {
                chrome.storage.local.remove(['originalBaseTimeCache', 'todayLimitCache'], resolve);
            });
            console.log('Cleared additionalTime cache during daily reset - additionalTime set to 0');
        } catch (error) {
            console.warn('Could not clear additionalTime cache:', error);
        }
        
        // Reset in-memory state variables
        urlTimes = {};
        urlAccumulatedTimes = {};
        notificationStates = {};
        urlStateTransitions = new Map();
        tabTimes = {};
        accumulatedTime = {};
        accumulatedActiveTime = {};
        
        // Get current blocked URLs but preserve their configurations
        const result = await new Promise(resolve => {
            chrome.storage.local.get('blocked_urls', resolve);
        });
        
        let blockedUrls = result.blocked_urls || [];
        
        // Reset all fields to their default values (matching server behavior)
        blockedUrls = blockedUrls.map(url => {
            const todayLimit = parseFloat(url.today_limit || "0");
            const timeLimit = url.is_temporary === "true" || url.is_temporary === true 
                ? parseFloat(url.temporary_time || "0")
                : parseFloat(url.default_time || "0");
            
            return {
                ...url,
                visited: parseFloat(url.default_time || "0") === 0 ? "true" : "false", // Block if default_time is 0
                half_time_notified: "false",
                one_quarter_notified: "false",
                three_quarter_notified: "false",
                used_time: "0.0",
                time: "0.0", // Keep for backward compatibility
                edit: false,
                is_temporary: false,
                temporary_time: url.default_time || "0",
                today_limit: url.default_time || "0",
            };
        });
        
        // Prepare storage updates
        const storageUpdates = {
            'blocked_urls': blockedUrls,
            'blockerUrlTimes': {},
            'blockerUrlAccumulatedTimes': {},
            'blockerNotificationStates': {},
            'blockerUrlStateTransitions': {},
            'blockerTabTimes': {}
        };
        
        // Update local storage with reset data
        await new Promise(resolve => {
            chrome.storage.local.set(storageUpdates, resolve);
        });
        
        // Save the reset state variables to storage
        await setState(STORAGE_KEYS.URL_TIMES, urlTimes);
        await setState(STORAGE_KEYS.URL_ACCUMULATED_TIMES, urlAccumulatedTimes);
        await setState(STORAGE_KEYS.TAB_TIMES, tabTimes);
        await setState(STORAGE_KEYS.NOTIFICATION_STATES, notificationStates);
        await saveMapToStorage(urlStateTransitions, STORAGE_KEYS.URL_STATE_TRANSITIONS);
        
        // Clean up redirect manager data
        await redirectManager.cleanup();
        
        // Save the last reset time
        const resetTimestamp = Date.now();
        await setState('lastResetTime', resetTimestamp);
        console.log(`Reset timestamp saved: ${new Date(resetTimestamp).toLocaleString()}`);
        
        console.log("Daily reset completed successfully");
        
        // Force reload any open tabs that match blocked sites to reflect unblocked status after 2 seconds
        try {
            const tabs = await chrome.tabs.query({});
            const tabsToReload = [];
            
            for (const tab of tabs) {
                if (tab.url) {
                    for (const url of blockedUrls) {
                        // Use the URL pattern to check if this tab matches a blocked site
                        const pattern = createBlockRegex(url.block_urls);
                        if (pattern.test(tab.url)) {
                            console.log(`Will reload tab ${tab.id} in 2 seconds to reflect unblocked status for ${url.block_urls}`);
                            tabsToReload.push({ tabId: tab.id, blockUrl: url.block_urls });
                            break;
                        }
                    }
                }
            }
            
            // Reload tabs after 2 seconds
            if (tabsToReload.length > 0) {
                setTimeout(() => {
                    tabsToReload.forEach(({ tabId, blockUrl }) => {
                        console.log(`Reloading tab ${tabId} to reflect unblocked status for ${blockUrl}`);
                        chrome.tabs.reload(tabId);
                    });
                }, 2000);
            }
        } catch (error) {
            console.error("Error reloading tabs after reset:", error);
        }
        
        return blockedUrls.length;
    } catch (error) {
        console.error("Error during scheduled reset:", error);
        throw error;
    }
}

// Function to check if it's time for the daily reset (set to 11:59 PM)
export async function checkAndPerformDailyReset() {
    try {
        // Test configuration
        const TEST_MODE = false; // Enable/disable test mode
        const TEST_HOURS = [18]; // Test reset hours (5 PM)
        const TEST_MINUTES = [22, 26, 30, 34, 38]; // Test reset minutes
        
        // Reset time configuration
        const RESET_HOUR = 19; // 11 PM
        const RESET_MINUTES = 58; // 59 minutes

        // Check if user is cloud or local
        const token = await getAccessToken();
        const isCloudUser = !!token;
        
        console.log(`User type: ${isCloudUser ? 'CLOUD' : 'LOCAL'}`);
        
        // Get the current time in the user's local time zone
        const now = new Date();
        const currentHour = now.getHours();
        const currentMinutes = now.getMinutes();
        
        console.log(`Current time: ${currentHour}:${currentMinutes} - Checking for reset condition`);
        
        // Get both last reset time and installation date
        const storageResult = await new Promise(resolve => {
            chrome.storage.local.get(['lastResetTime', 'extensionInstallDate'], resolve);
        });
        
        const lastResetTime = storageResult.lastResetTime ? new Date(storageResult.lastResetTime) : null;
        let installDate = storageResult.extensionInstallDate ? new Date(storageResult.extensionInstallDate) : null;
        
        // If no install date is recorded, set it to now (for existing installations)
        if (!installDate) {
            installDate = new Date();
            await new Promise(resolve => {
                chrome.storage.local.set({ 'extensionInstallDate': installDate.getTime() }, resolve);
            });
            console.log("Extension install date set to:", installDate.toLocaleString());
        }
        
        // For new installations, set initial reset time to installation date at reset time
        if (!lastResetTime) {
            console.log("No previous reset time found - new installation detected");
            
            // Calculate the first reset time based on installation date
            const firstResetDate = new Date(installDate);
            firstResetDate.setHours(RESET_HOUR, RESET_MINUTES, 0, 0);
            
            // If installation was after today's reset time, first reset is tomorrow
            if (installDate.getHours() > RESET_HOUR || 
                (installDate.getHours() === RESET_HOUR && installDate.getMinutes() >= RESET_MINUTES)) {
                firstResetDate.setDate(firstResetDate.getDate() + 1);
            }
            
            console.log(`First reset scheduled for: ${firstResetDate.toLocaleString()}`);
            
            // Check if it's time for the first reset
            if (now >= firstResetDate) {
                console.log("Time for first reset since installation");
                const resetCount = isCloudUser ? await resetAllUrls() : await scheduledResetAllUrlsLocal();
                console.log(`First reset completed. Reset ${resetCount} URLs.`);
                return true;
            } else {
                console.log(`Waiting for first reset at ${firstResetDate.toLocaleString()}`);
                return false;
            }
        }
        
        // Test mode: Reset at specific test hours and minutes
        if (TEST_MODE) {
            const isTestTime = TEST_HOURS.includes(currentHour) && TEST_MINUTES.includes(currentMinutes);
            
            if (isTestTime) {
                // Check if we already reset at this exact time today
                const lastResetHour = lastResetTime.getHours();
                const lastResetMinutes = lastResetTime.getMinutes();
                const isSameDay = lastResetTime.getDate() === now.getDate() && 
                                lastResetTime.getMonth() === now.getMonth() && 
                                lastResetTime.getFullYear() === now.getFullYear();
                
                if (isSameDay && lastResetHour === currentHour && lastResetMinutes === currentMinutes) {
                    console.log(`Test mode: Reset already performed at ${currentHour}:${currentMinutes} today, skipping`);
                    return false;
                }
                
                console.log(`Test mode: It's ${currentHour}:${currentMinutes} - performing test reset`);
                const resetCount = isCloudUser ? await resetAllUrls() : await scheduledResetAllUrlsLocal();
                console.log(`Test reset completed. Reset ${resetCount} URLs.`);
                return true;
            }
            
            const testTimes = TEST_HOURS.flatMap(h => TEST_MINUTES.map(m => `${h}:${m}`)).join(', ');
            console.log(`Test mode: Waiting for test times: ${testTimes}`);
            return false;
        }
        
        // Production mode: Calculate next reset time based on last reset
        const nextResetTime = new Date(lastResetTime);
        nextResetTime.setDate(nextResetTime.getDate() + 1); // Next day
        nextResetTime.setHours(RESET_HOUR, RESET_MINUTES, 0, 0);
        
        console.log(`Last reset: ${lastResetTime.toLocaleString()}`);
        console.log(`Next reset: ${nextResetTime.toLocaleString()}`);
        console.log(`Current time: ${now.toLocaleString()}`);
        
        // Check if it's time for the next reset
        if (now >= nextResetTime) {
            // Ensure we don't reset multiple times in the same minute
            const timeSinceLastReset = now.getTime() - lastResetTime.getTime();
            const minimumResetInterval = 23 * 60 * 60 * 1000; // 23 hours minimum
            
            if (timeSinceLastReset >= minimumResetInterval) {
                console.log("Time for daily reset");
                const resetCount = isCloudUser ? await resetAllUrls() : await scheduledResetAllUrlsLocal();
                console.log(`Daily reset completed at ${now.toLocaleString()}. Reset ${resetCount} URLs.`);
                return true;
            } else {
                console.log(`Reset too recent (${Math.round(timeSinceLastReset / (60 * 1000))} minutes ago), skipping`);
                return false;
            }
        }
        
        console.log(`Waiting for next reset at ${nextResetTime.toLocaleString()}`);
        return false;
    } catch (error) {
        console.error("Error checking for daily reset:", error);
        return false;
    }
}

// Function to check if a reset is due today
export async function checkAndPerformScheduledReset() {
    try {
        // Get reset configuration
        const config = await new Promise(resolve => {
            chrome.storage.local.get('resetConfig', resolve);
        });
        
        const resetConfig = config.resetConfig || { 
            enabled: false,
            frequency: 'daily', // 'daily', 'weekly', or 'monthly'
            dayOfWeek: 1,       // 0 = Sunday, 1 = Monday, etc.
            dayOfMonth: 1,      // 1-31
            lastResetTime: 0    // Timestamp of last reset
        };
        
        // If reset is not enabled, exit
        if (!resetConfig.enabled) {
            console.log("Scheduled reset is not enabled");
            return false;
        }
        
        const now = new Date();
        const lastReset = new Date(resetConfig.lastResetTime);
        
        let shouldReset = false;
        
        // Check if reset is due based on frequency
        if (resetConfig.frequency === 'daily') {
            // Reset if last reset was not today
            shouldReset = 
                now.getDate() !== lastReset.getDate() || 
                now.getMonth() !== lastReset.getMonth() || 
                now.getFullYear() !== lastReset.getFullYear();
        } 
        else if (resetConfig.frequency === 'weekly') {
            // Reset if today is the configured day of week and last reset was more than 6 days ago
            const dayDiff = Math.floor((now - lastReset) / (1000 * 60 * 60 * 24));
            shouldReset = now.getDay() === resetConfig.dayOfWeek && dayDiff >= 6;
        }
        else if (resetConfig.frequency === 'monthly') {
            // Reset if today is the configured day of month and last reset was in a different month
            shouldReset = 
                now.getDate() === resetConfig.dayOfMonth && 
                (now.getMonth() !== lastReset.getMonth() || now.getFullYear() !== lastReset.getFullYear());
        }
        
        if (shouldReset) {
            console.log("Scheduled reset is due, performing reset...");
            
            // Perform the reset
            const resetCount = await resetAllUrls();
            
            // Update last reset time
            resetConfig.lastResetTime = Date.now();
            await new Promise(resolve => {
                chrome.storage.local.set({ 'resetConfig': resetConfig }, resolve);
            });
            
            console.log(`Scheduled reset completed. Reset ${resetCount} URLs.`);
            return true;
        }
        
        console.log("No scheduled reset due at this time");
        return false;
    } catch (error) {
        console.error("Error checking for scheduled reset:", error);
        return false;
    }
}

// These functions will be imported by other modules to avoid direct references to the activeTabId
// which will be managed in index.js
let activeTabId = null;
let activeTabStartTime = null;
export const getActiveTabId = () => activeTabId;
export const getActiveTabStartTime = () => activeTabStartTime;
export const setActiveTab = (tabId, startTime = Date.now()) => {
    activeTabId = tabId;
    activeTabStartTime = startTime;
};
export const resetActiveTabStartTime = () => {
    activeTabStartTime = Date.now();
};

// Function to update existing notification states in blockerNotificationStates
export async function updateExistingNotificationStates(urlNotificationUpdates) {
    try {
        const result = await new Promise(resolve => {
            chrome.storage.local.get('blockerNotificationStates', resolve);
        });
        
        const currentStates = result.blockerNotificationStates || {};
        
        // Update existing entries
        Object.keys(urlNotificationUpdates).forEach(url => {
            if (currentStates[url]) {
                currentStates[url] = { ...currentStates[url], ...urlNotificationUpdates[url] };
                console.log(`Updated existing notification states for ${url}:`, currentStates[url]);
            }
        });
        
        // Save back to storage
        await new Promise(resolve => {
            chrome.storage.local.set({ 'blockerNotificationStates': currentStates }, resolve);
        });
        
        console.log('Notification states updated successfully');
        return true;
    } catch (error) {
        console.error('Error updating notification states:', error);
        return false;
    }
}

// Import createBlockRegex here to avoid circular dependency
import { createBlockRegex } from './urlUtils';