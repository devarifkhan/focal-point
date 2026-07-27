import { compareUrls, normalizeUrl, createBlockRegex } from './urlUtils';
import redirectManager from './redirectManager';
import { 
    urlTimes, urlAccumulatedTimes, notificationStates, 
    tabTimes, accumulatedTime, accumulatedActiveTime,
    getActiveTabId, resetActiveTabStartTime, urlStateTransitions
} from './stateManager';
import { API_BASE_URL, DEFAULT_CHECK_INTERVAL, WARNING_PAGE_URL } from "../constants/contants";
import { setState } from './storage';
import { updateUrl, updateNotificationState, updateApiAndResetStates, reset_Time, setTemporaryTimeToDefaultTime } from './apiService';
import { fetchUrls } from './apiService';
import { showTimeNotification } from './notificationHelper';
import webSocketApiService from '../../../services/WebSocketApiService.js';

// Storage for tracking notification IDs
const notificationIds = new Map();

// Tracker state variables
let isPaused = false;
let pauseReason = "";
let timeTrackerController = null;

// Periodic update state variables
let lastPeriodicUpdate = new Map(); // Track last update time for each URL
const PERIODIC_UPDATE_INTERVAL = 30000; // 30 seconds

// Track tabs that have been recently reloaded to prevent multiple reloads
const recentlyReloadedTabs = new Map();

// Store the ID of the warning page tab and the original tab URL for later use
let warningPageTabId = null;
let originalSiteUrl = null;
// Add a timeout to prevent opening multiple warning pages in quick succession
let warningPageDebounceTimer = null;
// Add a flag to track if we're currently processing a warning page opening
let isOpeningWarningPage = false;
// Track the last warning shown to prevent rapid successive warnings
let lastWarningShown = new Map(); // URL -> { percentage, timestamp }

// Helper function to mark a tab as recently reloaded
export function markTabAsReloaded(tabId) {
    recentlyReloadedTabs.set(tabId, Date.now());
    
    // Clear the flag after a cooldown period
    setTimeout(() => {
        recentlyReloadedTabs.delete(tabId);
    }, 5000); // 5 second cooldown
}

// Helper function to check if a tab was recently reloaded
export function wasTabRecentlyReloaded(tabId) {
    return recentlyReloadedTabs.has(tabId);
}

// Helper function to inject and execute content script
export async function injectContentScript(tabId) {
    try {
        await chrome.scripting.executeScript({
            target: { tabId },
            files: ["contentScript.bundle.js"]
        });
        return true;
    } catch (err) {
        console.error("Error injecting content script:", err);
        return false;
    }
}

// Helper function to send message to tab with retry
export async function sendMessageToTab(tab, message, maxRetries = 3) {
    for (let i = 0; i < maxRetries; i++) {
        try {
            // First inject the content script
            await injectContentScript(tab.id);

            // Wait a small amount of time to ensure script is loaded
            await new Promise(resolve => setTimeout(resolve, 100));

            // Try to send the message
            await chrome.tabs.sendMessage(tab.id, message);
            return true;
        } catch (err) {
            console.error(`Failed to send message to tab (attempt ${i+1}):`, err);
            if (i === maxRetries - 1) {
                return false;
            }
            // Wait before retrying
            await new Promise(resolve => setTimeout(resolve, 200 * (i + 1)));
        }
    }
    return false;
}

// Helper function to show notifications
export async function showNotification(matchingElement, trackingUrl, percentage) {
    // Skip notifications if time limit is 0
    const timeLimit = matchingElement.temporary_time || matchingElement.default_time || 0;
    if (timeLimit === 0) {
        return;
    }

    // Pause the time tracking while showing notification
    isPaused = true;
    pauseReason = "notification";
    
    const timeSpentMinutes = Math.floor(accumulatedTime[trackingUrl] / 60000);
    const title = `${percentage}% of the allocated time has been utilized. Please prioritize critical tasks for the remaining duration.`;
    
    // Get the current tab URL
    let originalTabUrl = '';
    try {
        const tabs = await chrome.tabs.query({active: true, currentWindow: true});
        console.log('Active tabs found:', tabs.length, tabs.length > 0 ? tabs[0].url : 'none');
        originalTabUrl = tabs.length > 0 ? tabs[0].url : '';
        
        if (!originalTabUrl && trackingUrl) {
            originalTabUrl = trackingUrl;
        }
    } catch (error) {
        console.error('Error getting active tab URL:', error);
    }
    
    // Show Chrome native notification instead of opening a tab
    await showTimeNotification({
        percentage,
        timeSpentMinutes,
        totalTimeMinutes: timeLimit,
        urlDomain: matchingElement.block_urls,
        customMessage: matchingElement.message || "",
        redirectUrl: matchingElement.redirect_urls,
        onContinueClick: () => {
            // User clicked continue, resume time tracking
            console.log("User continued browsing after notification");
            if (pauseReason === "notification") {
                isPaused = false;
                pauseReason = "";
                console.log("Time tracking resumed after user clicked continue");
            }
        },
        onRedirectClick: async () => {
            // User clicked to switch to the redirect URL
            if (matchingElement.redirect_urls) {
                const redirectUrl = matchingElement.redirect_urls.startsWith("http")
                    ? matchingElement.redirect_urls
                    : `https://www.${matchingElement.redirect_urls.replace(/^www\./, "")}`;
                
                await chrome.tabs.create({ url: redirectUrl });
                
                // Also resume time tracking since user made a decision
                if (pauseReason === "notification") {
                    isPaused = false;
                    pauseReason = "";
                    console.log("Time tracking resumed after user clicked redirect");
                }
            }
        }
    });
    
    // Update notification states in memory
    if (percentage === 50) {
        notificationStates[trackingUrl].halfTimeShown = true;
    } else if (percentage === 75) {
        notificationStates[trackingUrl].threeQuarterShown = true;
    }
    
    await setState('blockerNotificationStates', notificationStates);
    
    // Also update blockerNotificationStates storage with normalized URL
    chrome.storage.local.get('blockerNotificationStates', (result) => {
        const currentStates = result.blockerNotificationStates || {};
        const normalizedUrl = trackingUrl.replace(/\/$/, '');
        currentStates[normalizedUrl] = {
            halfTimeShown: notificationStates[trackingUrl].halfTimeShown,
            oneQuarterShown: notificationStates[trackingUrl].oneQuarterShown,
            threeQuarterShown: notificationStates[trackingUrl].threeQuarterShown
        };
        chrome.storage.local.set({ 'blockerNotificationStates': currentStates });
    });
    
    // Update notification state via API or local storage
    await updateNotificationState(matchingElement.id, 
        percentage === 50 ? "half_time_notified" : "three_quarter_notified", 
        timeSpentMinutes);
}

// Handle time limit reached scenario
export async function handleTimeLimit(redirectUrl, matchingElement, normalizedUrl) {
    try {
        const blockUrl = matchingElement.block_urls;
        const blockPattern = createBlockRegex(blockUrl);
        
        // Check for YouTube or other problematic domains
        const isSpecialDomain = blockUrl.includes('youtube.com') || 
                               blockUrl.includes('youtu.be') ||
                               blockUrl.includes('facebook.com') ||
                               blockUrl.includes('twitter.com') ||
                               blockUrl.includes('instagram.com');

        // Skip recent redirect check for special domains
        if (!isSpecialDomain && await redirectManager.hasRecentRedirect(blockUrl)) {
            console.log("Skipping redirect because of recent redirect:", blockUrl);
            return;
        }

        // Try to acquire a lock - if we can't get it, another process is already handling this
        if (!redirectManager.acquireLock(blockUrl)) {
            console.log("Skipping redirect because lock could not be acquired:", blockUrl);
            return;
        }

        // Set the in-progress flag immediately to prevent race conditions
        redirectManager.setRedirectInProgress(true);

        // Record redirect - this will increment the count and persist the timestamp
        await redirectManager.recordRedirect(blockUrl);
        
        // Get the current redirect count
        const redirectCount = await redirectManager.getRedirectCount(blockUrl);
        console.log(`Current redirect count for ${blockUrl}: ${redirectCount}`);

        const allTabs = await chrome.tabs.query({});
        const matchingTabs = allTabs.filter(tab => blockPattern.test(tab.url));

        if (matchingTabs.length > 0) {
            console.log(`Found ${matchingTabs.length} tabs matching ${blockUrl} to update`);
            
            // Force immediate reload of all matching tabs, but only if they haven't been reloaded recently
            await Promise.all(matchingTabs.map(async tab => {
                if (!wasTabRecentlyReloaded(tab.id)) {
                    // Mark as reloaded first to prevent multiple reloads
                    markTabAsReloaded(tab.id);
                    
                    try {
                        // First try sending a message to the content script to see if it's loaded
                        const response = await chrome.tabs.sendMessage(tab.id, { type: 'PING' }).catch(() => null);
                        
                        if (response && response.status === 'alive') {
                            // Content script is active, send block message directly
                            console.log(`Content script is active in tab ${tab.id}, sending block message`);
                            await chrome.tabs.sendMessage(tab.id, {
                                message: true,
                                redirectUrl: matchingElement.redirect_urls || '',
                                customMessage: matchingElement.message || '',
                                image: matchingElement.image || ''
                            });
                        } else {
                            // Content script not active, reload tab to activate it
                            console.log(`Content script not active in tab ${tab.id}, reloading tab`);
                            await chrome.tabs.reload(tab.id, { bypassCache: true });
                        }
                    } catch (error) {
                        console.error(`Error handling tab ${tab.id}:`, error);
                        // Fallback to standard reload
                        await chrome.tabs.reload(tab.id, { bypassCache: true });
                    }
                    
                    console.log(`Tab ${tab.id} handled for blocking`);
                } else {
                    console.log(`Tab ${tab.id} was recently reloaded, skipping`);
                }
            }));

            // Only create one redirect tab, regardless of how many matching tabs we found
            // Check if URL is already marked as redirected to prevent duplicate redirects
            if (matchingElement.redirect_urls && !redirectManager.isUrlRedirected(blockUrl)) {
                const redirectUrl = matchingElement.redirect_urls.startsWith("http")
                    ? matchingElement.redirect_urls
                    : `https://www.${matchingElement.redirect_urls.replace(/^www\./, "")}`;

                // Create the redirect tab
                await chrome.tabs.create({ url: redirectUrl });
                console.log(`Created redirect tab for ${blockUrl} (redirect #${redirectCount})`);
                
                // Mark the URL as redirected to prevent navigationHandler from creating another redirect
                redirectManager.setUrlRedirected(blockUrl, true);
            } else if (matchingElement.redirect_urls) {
                console.log(`Skipping redirect tab creation for ${blockUrl} because URL is already marked as redirected`);
            }
        } else {
            console.log(`No tabs found matching ${blockUrl}`);
        }
    } catch (error) {
        console.error('Error in handleTimeLimit:', error);
        // Reset the in-progress flag if there was an error
        redirectManager.setRedirectInProgress(false);
        // Release the lock if there was an error
        redirectManager.releaseLock(blockUrl);
    }
}

// Cache to store original base time when limit was increased
const originalBaseTimeCache = {};
const todayLimitCache = {}; // Track when today_limit changes

// Save cache to storage
function saveBaseTimeCache() {
    chrome.storage.local.set({ originalBaseTimeCache, todayLimitCache });
}

// Function to clear base time cache
export function clearBaseTimeCache(urlKey = null) {
    if (urlKey) {
        delete originalBaseTimeCache[urlKey];
        delete todayLimitCache[urlKey];
    } else {
        // Clear all cache
        Object.keys(originalBaseTimeCache).forEach(key => delete originalBaseTimeCache[key]);
        Object.keys(todayLimitCache).forEach(key => delete todayLimitCache[key]);
    }
    saveBaseTimeCache();
}

// Load cache from storage on startup
chrome.storage.local.get(['originalBaseTimeCache', 'todayLimitCache'], (result) => {
    if (result.originalBaseTimeCache) {
        Object.assign(originalBaseTimeCache, result.originalBaseTimeCache);
    }
    if (result.todayLimitCache) {
        Object.assign(todayLimitCache, result.todayLimitCache);
    }
});

// Helper function to calculate percentage based on additional time for any time extensions
export function calculatePercentageForTemporaryTime(matchingElement, currentTimeMs) {
    const currentTimeMinutes = currentTimeMs / 60000;
    const currentLimit = matchingElement.is_temporary ? matchingElement.temporary_time : matchingElement.default_time;
    const usedTimeFromDb = parseFloat(matchingElement.used_time) || 0;
    const todayLimit = parseFloat(matchingElement.today_limit) || 0;
    
    // If current time is very small (less than 0.1 minutes), clear any cached values to ensure fresh calculation
    // This handles the case where daily reset occurred but cache wasn't properly cleared
    if (currentTimeMinutes < 0.1) {
        const cacheKey = `${matchingElement.id || matchingElement.block_urls}`;
        if (originalBaseTimeCache[cacheKey] || todayLimitCache[cacheKey]) {
            console.log(`Very small time usage (${currentTimeMinutes.toFixed(3)} min), clearing cached values for fresh calculation`);
            clearBaseTimeCache(cacheKey);
        }
    }
    
    // Check if user has increased time limit after already using time
    // This happens when: today_limit > used_time, meaning limit was increased
    if (usedTimeFromDb > 0 && todayLimit > usedTimeFromDb) {
        const cacheKey = `${matchingElement.id || matchingElement.block_urls}`;
        
        // Only update cache when today_limit actually changes
        if (!todayLimitCache[cacheKey] || todayLimitCache[cacheKey] !== todayLimit) {
            originalBaseTimeCache[cacheKey] = usedTimeFromDb;
            todayLimitCache[cacheKey] = todayLimit;
            saveBaseTimeCache();
        }
        
        const baseTimeWhenIncreased = originalBaseTimeCache[cacheKey];
        const additionalTimeAvailable = todayLimit - baseTimeWhenIncreased; // Additional time granted
        const currentAdditionalTimeUsed = Math.max(0, currentTimeMinutes - baseTimeWhenIncreased); // Time used from additional allocation
        
        if (additionalTimeAvailable > 0) {
            return {
                percentage: (currentAdditionalTimeUsed / additionalTimeAvailable) * 100,
                isBasedOnAdditionalTime: true,
                additionalTime: additionalTimeAvailable,
                baseTime: baseTimeWhenIncreased,
                timeUsedBeyondOriginal: currentAdditionalTimeUsed,
                originalUsedTime: baseTimeWhenIncreased
            };
        }
    }
    
    // For temporary time with default_time (legacy logic)
    if (matchingElement.temporary_time && matchingElement.default_time) {
        const originalBaseTime = matchingElement.default_time;
        
        // If current time is beyond the original base time, calculate based on additional time
        if (currentTimeMinutes > originalBaseTime) {
            const additionalTime = matchingElement.temporary_time - originalBaseTime; // Additional time granted
            const timeUsedBeyondOriginal = currentTimeMinutes - originalBaseTime; // Time used beyond original
            
            if (additionalTime > 0) {
                return {
                    percentage: (timeUsedBeyondOriginal / additionalTime) * 100,
                    isBasedOnAdditionalTime: true,
                    additionalTime: additionalTime,
                    baseTime: originalBaseTime,
                    timeUsedBeyondOriginal: timeUsedBeyondOriginal
                };
            }
        }
    }
    
    // Normal calculation when within original time or no additional time
    const totalTimeLimit = currentLimit * 60000;
    return {
        percentage: (currentTimeMs / totalTimeLimit) * 100,
        isBasedOnAdditionalTime: false,
        additionalTime: 0,
        baseTime: currentLimit
    };
}

// Check if time limit is exceeded
export function isTimeExceeded(currentTime, limitTime) {
    // Convert to numbers to ensure proper comparison
    const currentTimeNum = parseFloat(currentTime) || 0;
    const limitTimeNum = parseFloat(limitTime) || 0;
    
    // If limit is 0, never consider it exceeded
    if (limitTimeNum === 0) {
        return {
            isExceeded: false,
            adjustedTime: currentTimeNum
        };
    }
    
    // If the time limit has been reached or exceeded, return true
    if (currentTimeNum >= limitTimeNum) {
        // Return the exact limit time to ensure we display exactly the configured limit
        // instead of showing values like 1.01 or 1.02 min when the limit is 1 min
        return {
            isExceeded: true,
            adjustedTime: limitTimeNum // Use exact limit time, not the current time
        };
    }
    
    return {
        isExceeded: false,
        adjustedTime: currentTimeNum
    };
}

// Handle notifications for URL
export async function handleNotifications(matchingElement, trackingUrl, specificPercentage = null) {
    // Check notification states to prevent duplicate warnings
    if ((specificPercentage === 50 && notificationStates[trackingUrl]?.halfTimeShown) ||
        (specificPercentage === 75 && notificationStates[trackingUrl]?.threeQuarterShown)) {
        console.log(`Skipping ${specificPercentage}% warning for ${trackingUrl} - already shown`);
        return;
    }
    
    // Calculate time limits for notifications using the new logic
    const timeLimit = matchingElement.temporary_time || matchingElement.default_time || 0;
    
    // Skip notifications if time limit is 0 - URL should be immediately blocked
    if (timeLimit === 0) {
        console.log(`Skipping notifications for ${trackingUrl} - time limit is 0, URL should be blocked immediately`);
        return;
    }
    
    const totalTimeMilli = timeLimit * 60 * 1000;
    
    // Get current spent time
    const currentAccumulatedTime = accumulatedTime[trackingUrl] || 0;
    
    // Get percentage calculation result
    const percentageResult = calculatePercentageForTemporaryTime(matchingElement, currentAccumulatedTime);
    
    // Calculate thresholds based on whether we're using additional time or not
    let halfTime, threeQuarterTime;
    if (percentageResult.isBasedOnAdditionalTime) {
        // For additional time, calculate 50% and 75% of the additional time only
        // Start from the original used time (base) and add percentages of additional time
        const additionalTimeMilli = percentageResult.additionalTime * 60 * 1000;
        const baseTimeMilli = percentageResult.baseTime * 60 * 1000;
        halfTime = baseTimeMilli + (additionalTimeMilli * 0.5);
        threeQuarterTime = baseTimeMilli + (additionalTimeMilli * 0.75);
    } else {
        // Normal calculation
        halfTime = totalTimeMilli * 0.5;
        threeQuarterTime = totalTimeMilli * 0.75;
    }
    const activeTime = accumulatedActiveTime[trackingUrl] || 0;
    const timeSpentMinutes = Math.floor(currentAccumulatedTime / 60000);
    const activeTimeSpentMinutes = Math.floor(activeTime / 60000);
    
    // Get the current tab URL (needed for API updates)
    let originalTabUrl = '';
    try {
        const tabs = await chrome.tabs.query({active: true, currentWindow: true});
        originalTabUrl = tabs.length > 0 ? tabs[0].url : '';
        
        if (!originalTabUrl && trackingUrl) {
            originalTabUrl = trackingUrl;
        }
    } catch (error) {
        console.error('Error getting active tab URL in handleNotifications:', error);
    }

    // Track if we've shown a notification in this handler call
    let notificationShown = false;

    // Check if warning page is already open - if so, don't show another
    if (warningPageTabId) {
        console.log("Warning page already open with ID:", warningPageTabId, "- closing previous warning page");
        // Close the existing warning page
        try {
            await chrome.tabs.remove(warningPageTabId);
            warningPageTabId = null;
            originalSiteUrl = null;
        } catch (error) {
            console.error("Error closing existing warning page:", error);
        }
    }

    // Special case: if time has just been reset (e.g., site was deleted and re-added)
    // make sure we don't immediately show notifications
    if (activeTime < 5000 && (notificationStates[trackingUrl].halfTimeShown || notificationStates[trackingUrl].threeQuarterShown)) {
        console.log("Time appears to have been reset recently, resetting notification states");
        notificationStates[trackingUrl] = {
            halfTimeShown: false,
            oneQuarterShown: false,
            threeQuarterShown: false
        };
        await setState('blockerNotificationStates', notificationStates);
        return;
    }
    
    // Additional check: if used_time is very small but notification states are set, reset them
    const currentTimeMinutes = currentAccumulatedTime / 60000;
    if (currentTimeMinutes < 0.1 && (notificationStates[trackingUrl].halfTimeShown || notificationStates[trackingUrl].threeQuarterShown)) {
        console.log(`Very small time usage (${currentTimeMinutes.toFixed(3)} min) but notifications shown - resetting states`);
        notificationStates[trackingUrl] = {
            halfTimeShown: false,
            oneQuarterShown: false,
            threeQuarterShown: false
        };
        await setState('blockerNotificationStates', notificationStates);
        return;
    }

    // If a specific percentage is provided, show that notification directly
    if (specificPercentage === 75 && !notificationStates[trackingUrl].threeQuarterShown && !isOpeningWarningPage) {
        // Prevent multiple warning pages from being opened at the same time
        if (warningPageDebounceTimer) {
            clearTimeout(warningPageDebounceTimer);
            warningPageDebounceTimer = null;
        }
        
        isOpeningWarningPage = true;
        
        // IMMEDIATELY mark notification as shown to prevent multiple warnings for logged out users
        notificationStates[trackingUrl].threeQuarterShown = true;
        await setState('blockerNotificationStates', notificationStates);
        
        // Also update blockerNotificationStates storage with normalized URL
        chrome.storage.local.get('blockerNotificationStates', (result) => {
            const currentStates = result.blockerNotificationStates || {};
            const normalizedUrl = trackingUrl.replace(/\/$/, '');
            currentStates[normalizedUrl] = {
                halfTimeShown: notificationStates[trackingUrl].halfTimeShown,
                oneQuarterShown: notificationStates[trackingUrl].oneQuarterShown,
                threeQuarterShown: notificationStates[trackingUrl].threeQuarterShown
            };
            chrome.storage.local.set({ 'blockerNotificationStates': currentStates });
        });
        
        // Also update local storage for logged out users
        await updateLocalStorageNotificationState(trackingUrl, 'three_quarter_notified', true);
        
        try {
            // Pause the time tracking while showing warning page
            isPaused = true;
            pauseReason = "warning_page_75";

            // Store the original site URL for later use
            originalSiteUrl = originalTabUrl;

            // Open warning.html page instead of showing Chrome native notification for 75% time
            const title = `75% of the allocated time has been utilized.`;
            const message = matchingElement.message || '';

            // Create the warning page URL with all necessary parameters
            let warningUrl = chrome.runtime.getURL('warning.html');
            warningUrl += `?timeSpent=${encodeURIComponent(activeTimeSpentMinutes)}`;
            warningUrl += `&totalTime=${encodeURIComponent(timeLimit)}`;
            warningUrl += `&title=${encodeURIComponent(title)}`;
            warningUrl += `&message=${encodeURIComponent(message)}`;
            warningUrl += `&blockSiteUrl=${encodeURIComponent(matchingElement.block_urls)}`;
            warningUrl += `&percentage=${encodeURIComponent(75)}`; // Add percentage parameter
            
            // Add redirect URL if it exists
            if (matchingElement.redirect_urls) {
                warningUrl += `&redirectUrl=${encodeURIComponent(matchingElement.redirect_urls)}`;
            }
            
            // Add original tab URL if it exists
            if (originalTabUrl) {
                warningUrl += `&originalTabUrl=${encodeURIComponent(originalTabUrl)}`;
            }
            
            // Add image URL if it exists
            if (matchingElement.image) {
                warningUrl += `&image=${encodeURIComponent(matchingElement.image)}`;
            }
            
            // Add calendar URL if it exists
            if (matchingElement.calender_url) {
                warningUrl += `&calendarUrl=${encodeURIComponent(matchingElement.calender_url)}`;
            }
            
            console.log("Opening 75% warning page:", warningUrl);

            // Open the warning page in a new tab and store the tab ID
            const tab = await chrome.tabs.create({ url: warningUrl });
            warningPageTabId = tab.id;
            console.log("Warning page tab created with ID:", warningPageTabId);

            // Set up a listener for tab focus change if it's not already set up
            setupTabFocusListener();

            // Update notification state in API/local storage
            await updateNotificationState(matchingElement.id, "three_quarter_notified", timeSpentMinutes);
            

            
            notificationShown = true;
        } catch (error) {
            console.error("Error opening 75% warning page:", error);
            // If error occurred, revert the notification state
            notificationStates[trackingUrl].threeQuarterShown = false;
            await setState('blockerNotificationStates', notificationStates);
            await updateLocalStorageNotificationState(trackingUrl, 'three_quarter_notified', false);
        } finally {
            // Set a timeout to prevent opening another warning page too soon
            warningPageDebounceTimer = setTimeout(() => {
                warningPageDebounceTimer = null;
            }, 5000); // 5 second cooldown
            
            isOpeningWarningPage = false;
        }
    }
    // Show 50% notification if specifically requested or if it's time for it
    else if ((specificPercentage === 50 || (!notificationShown && activeTime >= halfTime)) 
             && !notificationStates[trackingUrl].halfTimeShown && !isOpeningWarningPage) {
        // Prevent multiple warning pages from being opened at the same time
        if (warningPageDebounceTimer) {
            clearTimeout(warningPageDebounceTimer);
            warningPageDebounceTimer = null;
        }
        
        isOpeningWarningPage = true;
        
        // IMMEDIATELY mark notification as shown to prevent multiple warnings for logged out users
        notificationStates[trackingUrl].halfTimeShown = true;
        await setState('blockerNotificationStates', notificationStates);
        
        // Also update blockerNotificationStates storage with normalized URL
        chrome.storage.local.get('blockerNotificationStates', (result) => {
            const currentStates = result.blockerNotificationStates || {};
            const normalizedUrl = trackingUrl.replace(/\/$/, '');
            currentStates[normalizedUrl] = {
                halfTimeShown: notificationStates[trackingUrl].halfTimeShown,
                oneQuarterShown: notificationStates[trackingUrl].oneQuarterShown,
                threeQuarterShown: notificationStates[trackingUrl].threeQuarterShown
            };
            chrome.storage.local.set({ 'blockerNotificationStates': currentStates });
        });
        
        // Also update local storage for logged out users
        await updateLocalStorageNotificationState(trackingUrl, 'half_time_notified', true);
        
        try {
            // Pause the time tracking while showing warning page
            isPaused = true;
            pauseReason = "warning_page_50";

            // Store the original site URL for later use
            originalSiteUrl = originalTabUrl;

            // Open warning.html page instead of showing Chrome native notification for 50% time
            const title = `50% of the allocated time has been utilized.`;
            const message = matchingElement.message || '';

            // Create the warning page URL with all necessary parameters
            let warningUrl = chrome.runtime.getURL('warning.html');
            warningUrl += `?timeSpent=${encodeURIComponent(activeTimeSpentMinutes)}`;
            warningUrl += `&totalTime=${encodeURIComponent(timeLimit)}`;
            warningUrl += `&title=${encodeURIComponent(title)}`;
            warningUrl += `&message=${encodeURIComponent(message)}`;
            warningUrl += `&blockSiteUrl=${encodeURIComponent(matchingElement.block_urls)}`;
            warningUrl += `&percentage=${encodeURIComponent(50)}`; // Add percentage parameter
            
            // Add redirect URL if it exists
            if (matchingElement.redirect_urls) {
                warningUrl += `&redirectUrl=${encodeURIComponent(matchingElement.redirect_urls)}`;
            }
            
            // Add original tab URL if it exists
            if (originalTabUrl) {
                warningUrl += `&originalTabUrl=${encodeURIComponent(originalTabUrl)}`;
            }
            
            // Add image URL if it exists
            if (matchingElement.image) {
                warningUrl += `&image=${encodeURIComponent(matchingElement.image)}`;
            }
            
            // Add calendar URL if it exists
            if (matchingElement.calender_url) {
                warningUrl += `&calendarUrl=${encodeURIComponent(matchingElement.calender_url)}`;
            }
            
            console.log("Opening 50% warning page:", warningUrl);

            // Open the warning page in a new tab and store the tab ID
            const tab = await chrome.tabs.create({ url: warningUrl });
            warningPageTabId = tab.id;
            console.log("Warning page tab created with ID:", warningPageTabId);

            // Set up a listener for tab focus change if it's not already set up
            setupTabFocusListener();

            // Update notification state in API/local storage
            await updateNotificationState(matchingElement.id, "half_time_notified", timeSpentMinutes);
            

        } catch (error) {
            console.error("Error opening 50% warning page:", error);
            // If error occurred, revert the notification state
            notificationStates[trackingUrl].halfTimeShown = false;
            await setState('blockerNotificationStates', notificationStates);
            await updateLocalStorageNotificationState(trackingUrl, 'half_time_notified', false);
        } finally {
            // Set a timeout to prevent opening another warning page too soon
            warningPageDebounceTimer = setTimeout(() => {
                warningPageDebounceTimer = null;
            }, 5000); // 5 second cooldown
            
            isOpeningWarningPage = false;
        }
    }

    // Periodic update regardless of notifications
    const formDataPeriodically = new FormData();
    formDataPeriodically.append("used_time", parseFloat((currentAccumulatedTime / 60000).toFixed(2)));
    formDataPeriodically.append("time", parseFloat((currentAccumulatedTime / 60000).toFixed(2))); // Keep for backward compatibility
    await updateUrl(matchingElement.id, formDataPeriodically);
}

// Listen for tab activation (user switching tabs)
function setupTabFocusListener() {
    // Remove existing listener if present to avoid duplicates
    chrome.tabs.onActivated.removeListener(handleTabActivation);
    
    // Add the listener for tab activation
    chrome.tabs.onActivated.addListener(handleTabActivation);
    console.log("Tab focus listener set up");
    
    // Also listen for tab removal to clean up
    chrome.tabs.onRemoved.removeListener(handleTabRemoval);
    chrome.tabs.onRemoved.addListener(handleTabRemoval);
}

// Handle tab activation event - resume time tracking if user returns to the original tab
async function handleTabActivation(activeInfo) {
    try {
        // If tracking isn't paused or not paused for warning page, ignore
        if (!isPaused || (pauseReason !== "warning_page_75" && pauseReason !== "warning_page_50" && pauseReason !== "warning_page")) {
            return;
        }
        
        // Get the active tab
        const tab = await chrome.tabs.get(activeInfo.tabId);
        console.log("Tab activated:", tab.url);
        
        // If the user switched back to the original tab
        if (originalSiteUrl && tab.url) {
            // Use more flexible URL comparison to handle different formats of the same URL
            const normalizeForCompare = (url) => {
                try {
                    const urlObj = new URL(url);
                    return urlObj.origin + urlObj.pathname;
                } catch (e) {
                    console.error('Error normalizing URL:', e);
                    return url;
                }
            };
            
            const normalizedOriginal = normalizeForCompare(originalSiteUrl);
            const normalizedCurrent = normalizeForCompare(tab.url);
            
            // Check if URLs match either exactly or after normalization
            if (tab.url === originalSiteUrl || normalizedCurrent === normalizedOriginal) {
                console.log("User switched back to original site while warning page is open, resuming time tracking");
                
                // Resume time tracking
                isPaused = false;
                pauseReason = "";
                
                // Note: We don't close the warning page tab automatically here
                // to allow the user to interact with both tabs
            }
        }
    } catch (error) {
        console.error("Error in handleTabActivation:", error);
    }
}

// Handle tab removal event - cleanup the tab focus listener when the warning page is closed
function handleTabRemoval(tabId, removeInfo) {
    // If the warning page tab was closed, cleanup
    if (warningPageTabId && tabId === warningPageTabId) {
        console.log("Warning page tab closed, cleaning up");
        
        // Clear the warning page tab ID
        warningPageTabId = null;
        originalSiteUrl = null;
        
        // Resume time tracking if it was paused due to warning page
        if (isPaused && (pauseReason === "warning_page_75" || pauseReason === "warning_page_50" || pauseReason === "warning_page")) {
            console.log("Warning page closed, resuming time tracking");
            isPaused = false;
            pauseReason = "";
        }
        
        // Remove the tab focus listener
        chrome.tabs.onActivated.removeListener(handleTabActivation);
        chrome.tabs.onRemoved.removeListener(handleTabRemoval);
    }
}

// Start time tracking for all URLS
export function initializeTimeTracking() {
    let lastCheckTime = null;
    
    // Initialize WebSocket service
    webSocketApiService.initialize().catch(error => {
        console.error('Failed to initialize WebSocket service:', error);
    });
    
    // Set up WebSocket event listeners for real-time updates
    webSocketApiService.onUrlsUpdated((urls) => {
        console.log('Received real-time URL list update:', urls.length, 'URLs');
        // URLs are automatically cached in the WebSocket service
    });
    
    webSocketApiService.onUrlUpdated((urlData) => {
        console.log('Received real-time URL update:', urlData.id);
        // Individual URL updates are handled automatically
    });
    
    async function checkTime() {
        const activeTabId = getActiveTabId();
        if (activeTabId !== null) {
            const currentTime = Date.now();
            
            // Maintain time tracking state across login/logout
            const token = await (await import('./storage')).getAccessToken();
            // No longer clearing cached data on logout to maintain consistent state
            
            try {
                const tab = await chrome.tabs.get(activeTabId);
                const trackingUrl = await getTrackingUrl(tab.url);
                
                // Skip if trackingUrl is null (invalid URL)
                if (!trackingUrl) {
                    lastCheckTime = currentTime;
                    return;
                }
    
                // Check if current tab is warning page
                if (tab.url.includes(WARNING_PAGE_URL)) {
                    isPaused = true;
                    pauseReason = "warning_page";
                    lastCheckTime = currentTime;
                    return;
                }
    
                const urls = await fetchUrls();
                if (!urls || !Array.isArray(urls)) return;
    
                const matchingElement = urls.find((element) => {
                    return compareUrls(element.block_urls, tab.url);
                });
    
                if (matchingElement) {
                    // Convert visited to string if it's a boolean
                    const visited = typeof matchingElement.visited === 'boolean' 
                        ? matchingElement.visited.toString() 
                        : matchingElement.visited;
                    
                    // // Check if today_limit is 0 and effective time limit is 0 - if so, block the site immediately
                    // const todayLimit = parseFloat(matchingElement.today_limit || "0");
                    // const defaultTime = parseFloat(matchingElement.default_time || "0");
                    // const temporaryTime = parseFloat(matchingElement.temporary_time || "0");
                    // const usedTime = parseFloat(matchingElement.used_time || "0");

                    // console.log("todayLimit",todayLimit,"default time", defaultTime,"temporaryTime", temporaryTime,"usedtime", usedTime,"visited", visited);
                    // console.log("checkblock",todayLimit === 0 && defaultTime === 0 && temporaryTime === 0 && usedTime ===0 && visited !== "true");
                    // if (todayLimit === 0 && defaultTime === 0 && temporaryTime === 0 && usedTime ===0 && visited !== "true") {
                    //     // Update visited to true and send API update
                    //     await updateLocalStorageBlockedState(trackingUrl, true);
                        
                    //     const formData = new FormData();
                    //     formData.append("visited", "true");
                    //     await updateUrl(matchingElement.id, formData);
                        
                    //     console.log(`Site blocked due to all time limits = 0: ${trackingUrl}`);
                    //     return;
                    // }
                    
                    // Only track time if the site is not visited (blocked)
                    if (visited !== "true") {
                        // Check if this URL was recently deleted and re-added
                        const shouldResetStates = redirectManager.shouldResetNotificationStates(trackingUrl);
                        if (shouldResetStates) {
                            redirectManager.clearResetFlag(trackingUrl);
                        }
                        
                        // Always reload time from storage to prevent cached values from overwriting updates
                        const existingTimeInMinutes = parseFloat(matchingElement.used_time || matchingElement.time) || 0;
                        const existingTimeInMs = existingTimeInMinutes * 60000;
                        
                        // Check if user just logged out (no cached time but has storage data)
                        const isPostLogout = !accumulatedTime[trackingUrl] && existingTimeInMinutes > 0;
                        
                        // Force sync current URL time after logout
                        if (!token && !accumulatedTime[trackingUrl]) {
                            console.log(`Post-logout: syncing ${trackingUrl} time from ${existingTimeInMinutes} min`);
                            accumulatedTime[trackingUrl] = existingTimeInMs;
                            accumulatedActiveTime[trackingUrl] = existingTimeInMs;
                            urlTimes[trackingUrl] = existingTimeInMs;
                            urlAccumulatedTimes[trackingUrl] = existingTimeInMs;
                        }
                        
                        // Only reset if there's a VERY significant difference or if states should be reset
                        // This prevents constant resets due to minor sync delays between local and database
                        const timeDifferenceMinutes = Math.abs((accumulatedTime[trackingUrl] / 60000) - existingTimeInMinutes);
                        const shouldResetTime = !accumulatedTime[trackingUrl] || shouldResetStates || isPostLogout ||
                            (timeDifferenceMinutes > 1.0 && existingTimeInMinutes < (accumulatedTime[trackingUrl] / 60000));
                        
                        if (shouldResetTime) {
                            if (timeDifferenceMinutes > 1.0) {
                                console.log(`Significant time mismatch detected - cached: ${(accumulatedTime[trackingUrl] / 60000).toFixed(2)}min, storage: ${existingTimeInMinutes}min - using storage value`);
                            }
                            
                            const timeLimit = matchingElement.temporary_time || matchingElement.default_time || 0;
                            
                            // If time used is >= time limit, this is likely a fresh URL that needs reset
                            if (existingTimeInMinutes >= timeLimit && timeLimit > 0) {
                                console.log(`Fresh URL detected - time used (${existingTimeInMinutes}) >= limit (${timeLimit}), resetting to 0`);
                                accumulatedTime[trackingUrl] = 0;
                                
                                // Also reset in storage
                                try {
                                    const result = await new Promise(resolve => {
                                        chrome.storage.local.get('blocked_urls', resolve);
                                    });
                                    
                                    if (result.blocked_urls) {
                                        const updatedUrls = result.blocked_urls.map(url => {
                                            if (compareUrls(url.block_urls, trackingUrl)) {
                                                return {
                                                    ...url,
                                                    time: "0.00",
                                                    used_time: "0.00",
                                                    half_time_notified: "false",
                                                    one_quarter_notified: "false",
                                                    three_quarter_notified: "false"
                                                };
                                            }
                                            return url;
                                        });
                                        
                                        await new Promise(resolve => {
                                            chrome.storage.local.set({ 'blocked_urls': updatedUrls }, resolve);
                                        });
                                    }
                                } catch (error) {
                                    console.warn("Error resetting URL in storage:", error);
                                }
                            } else {
                                const existingTimeInMs = existingTimeInMinutes * 60000;
                                accumulatedTime[trackingUrl] = existingTimeInMs;
                            }
                            
                            console.log(`${shouldResetStates ? 'Reset and initialized' : 'Initialized'} accumulated time for ${trackingUrl} with ${(accumulatedTime[trackingUrl] / 60000).toFixed(2)} minutes`);
                            
                            // Log temporary_time if available for debugging
                            if (matchingElement.temporary_time) {
                                console.log(`Temporary time for ${trackingUrl}: ${matchingElement.temporary_time} minutes`);
                            }
                        } else {
                            // No significant mismatch - initialize if not set, otherwise use the higher value
                            if (!accumulatedTime[trackingUrl]) {
                                accumulatedTime[trackingUrl] = existingTimeInMs;
                                console.log(`Initialized accumulated time for ${trackingUrl} with ${existingTimeInMinutes.toFixed(2)} minutes from database`);
                            } else {
                                // Use the higher value to prevent time going backwards
                                const currentLocalTimeMinutes = accumulatedTime[trackingUrl] / 60000;
                                if (existingTimeInMinutes > currentLocalTimeMinutes) {
                                    console.log(`Database time (${existingTimeInMinutes.toFixed(2)}min) is ahead of local time (${currentLocalTimeMinutes.toFixed(2)}min), updating local time`);
                                    accumulatedTime[trackingUrl] = existingTimeInMs;
                                }
                            }
                        }
                        
                        // Always sync accumulatedActiveTime with accumulatedTime
                        accumulatedActiveTime[trackingUrl] = accumulatedTime[trackingUrl];
                        if (shouldResetStates || Math.abs((accumulatedActiveTime[trackingUrl] / 60000) - existingTimeInMinutes) > 0.1) {
                            console.log(`${shouldResetStates ? 'Reset and initialized' : 'Synced'} active time for ${trackingUrl} with ${accumulatedTime[trackingUrl]}ms`);
                        }
                        
                        // Always sync urlTimes with current accumulatedTime
                        urlTimes[trackingUrl] = accumulatedTime[trackingUrl];
                        urlAccumulatedTimes[trackingUrl] = accumulatedTime[trackingUrl];
                        
                        if (shouldResetStates) {
                            console.log(`Reset urlTimes for recently re-added URL: ${trackingUrl}`);
                        }
                        
                        // Initialize notification states if not exists or if URL was recently deleted and re-added
                        if (!notificationStates[trackingUrl] || shouldResetStates) {
                            // If URL was recently deleted and re-added, reset notification states regardless of API values
                            if (shouldResetStates) {
                                console.log(`Resetting notification states for recently re-added URL: ${trackingUrl}`);
                                notificationStates[trackingUrl] = {
                                    halfTimeShown: false,
                                    oneQuarterShown: false,
                                    threeQuarterShown: false
                                };
                            } else {
                                // Check if this is a fresh URL (time is 0 or very small) - if so, reset notification states
                                const existingTimeInMinutes = parseFloat(matchingElement.used_time || matchingElement.time) || 0;
                                const isVerySmallTime = existingTimeInMinutes < 0.1; // Less than 0.1 minutes (6 seconds)
                                
                                if (isVerySmallTime) {
                                    console.log(`Fresh URL detected (${existingTimeInMinutes} min used), resetting notification states: ${trackingUrl}`);
                                    notificationStates[trackingUrl] = {
                                        halfTimeShown: false,
                                        oneQuarterShown: false,
                                        threeQuarterShown: false
                                    };
                                } else {
                                    // Use the notification states from API if available
                                    notificationStates[trackingUrl] = {
                                        halfTimeShown: matchingElement.half_time_notified === "true" || matchingElement.half_time_notified === true,
                                        oneQuarterShown: matchingElement.one_quarter_notified === "true" || matchingElement.one_quarter_notified === true,
                                        threeQuarterShown: matchingElement.three_quarter_notified === "true" || matchingElement.three_quarter_notified === true
                                    };
                                }
                            }
                            await setState('blockerNotificationStates', notificationStates);
                        }

                        // Calculate time since last check only if not paused
                        const timeSinceLastCheck = (!isPaused && lastCheckTime) ? currentTime - lastCheckTime : 0;
    
                        // Update time tracking with the time since last check
                        if (timeSinceLastCheck > 0) {
                            accumulatedTime[trackingUrl] += timeSinceLastCheck;
                            accumulatedActiveTime[trackingUrl] += timeSinceLastCheck;
                            urlTimes[trackingUrl] = accumulatedTime[trackingUrl];
                            urlAccumulatedTimes[trackingUrl] = accumulatedTime[trackingUrl];
    
                            // Save to Chrome Storage to maintain state across login/logout
                            await setState('blockerUrlTimes', urlTimes);
                            await setState('blockerUrlAccumulatedTimes', urlAccumulatedTimes);
                            await setState('blockerNotificationStates', notificationStates);
    
                            // Calculate percentage of time used using the new logic
                            const timeLimit = matchingElement.is_temporary ? 
                                (matchingElement.temporary_time || matchingElement.default_time || 0) : 
                                (matchingElement.default_time || 0);
                            const totalTimeLimit = timeLimit * 60000;
                            const percentageResult = calculatePercentageForTemporaryTime(matchingElement, accumulatedTime[trackingUrl]);
                            const percentageUsed = percentageResult.percentage;
    
                            console.log('Time tracking:', {
                                percentageUsed,
                                isBasedOnAdditionalTime: percentageResult.isBasedOnAdditionalTime,
                                additionalTime: percentageResult.additionalTime,
                                currentTime: accumulatedTime[trackingUrl] / 60000,
                                activeTime: accumulatedActiveTime[trackingUrl] / 60000,
                                totalLimit: timeLimit,
                                isPaused,
                                pauseReason,
                                notificationState: notificationStates[trackingUrl]
                            });
    
                            // Update local storage URL time for non-authenticated users
                            updateLocalStorageTime(trackingUrl, accumulatedTime[trackingUrl]);
    
                            // Send periodic update to database/WebSocket for authenticated users
                            const token = await (await import('./storage')).getAccessToken();
                            if (token) {
                                const now = Date.now();
                                const lastUpdate = lastPeriodicUpdate.get(trackingUrl) || 0;
                                
                                // Only send update if enough time has passed (30 seconds)
                                if (now - lastUpdate >= PERIODIC_UPDATE_INTERVAL) {
                                    try {
                                        const currentTimeMinutes = (accumulatedTime[trackingUrl] / 60000).toFixed(2);
                                        const periodicFormData = new FormData();
                                        periodicFormData.append("used_time", parseFloat(currentTimeMinutes));
                                        periodicFormData.append("time", parseFloat(currentTimeMinutes)); // Keep for backward compatibility
                                        
                                        // Send update without waiting to avoid blocking the main loop
                                        updateUrl(matchingElement.id, periodicFormData).catch(error => {
                                            console.error("Error sending periodic time update:", error);
                                        });
                                        
                                        // Update the last update timestamp
                                        lastPeriodicUpdate.set(trackingUrl, now);
                                        
                                        console.log(`Sent periodic time update: ${currentTimeMinutes} minutes for ${trackingUrl}`);
                                    } catch (error) {
                                        console.error("Error in periodic time update:", error);
                                    }
                                }
                            }
    
                            // Check notifications if we crossed any thresholds - but only if timeLimit > 0
                                if (timeLimit > 0) {
                                    // Use the new percentage calculation that handles temporary time
                                    const percentageResult = calculatePercentageForTemporaryTime(matchingElement, accumulatedTime[trackingUrl]);
                                    const exactPercentage = percentageResult.percentage;
                                    
                                    // Check for 50% time notification - must be LESS than 75% to show the 50% notification
                                    if (exactPercentage >= 50 && exactPercentage < 75 && !notificationStates[trackingUrl].halfTimeShown) {
                                        console.log(`Showing 50% notification with exact percentage: ${exactPercentage.toFixed(2)}%`);
                                        await handleNotifications(matchingElement, trackingUrl, 50);
                                        lastCheckTime = currentTime;
                                        return;
                                    }
                                    
                                    // Check for 75% time notification
                                    if (exactPercentage >= 75 && !notificationStates[trackingUrl].threeQuarterShown) {
                                        console.log(`Showing 75% notification with exact percentage: ${exactPercentage.toFixed(2)}%`);
                                        await handleNotifications(matchingElement, trackingUrl, 75);
                                        lastCheckTime = currentTime;
                                        return;
                                    }
                                }
    
                            const currentTimeMinutes = accumulatedTime[trackingUrl] / 60000;
                            // Determine the correct time limit to use based on percentage calculation result
                            const limitPercentageResult = calculatePercentageForTemporaryTime(matchingElement, accumulatedTime[trackingUrl]);
                            let totalTimeLimitMinutes;
                            
                            if (percentageResult.isBasedOnAdditionalTime) {
                                // When using additional time, total limit = base time + additional time
                                totalTimeLimitMinutes = percentageResult.baseTime + percentageResult.additionalTime;
                            } else {
                                // Normal calculation - use the configured limit
                                if (matchingElement.is_temporary && matchingElement.temporary_time > 0) {
                                    totalTimeLimitMinutes = matchingElement.temporary_time;
                                } else {
                                    totalTimeLimitMinutes = matchingElement.default_time || 0;
                                }
                                
                                // Only use today_limit if it's greater than the primary limit (indicating time was extended)
                                if (matchingElement.today_limit > totalTimeLimitMinutes) {
                                    totalTimeLimitMinutes = matchingElement.today_limit;
                                }
                            }
    
                            // Check if time limit is reached using our updated function
                            const timeExceededResult = isTimeExceeded(currentTimeMinutes, totalTimeLimitMinutes);
                            
                            if (timeExceededResult.isExceeded) {
                                // Update the accumulated time with our adjusted time to prevent values like 1.01, 1.02, etc.
                                accumulatedTime[trackingUrl] = timeExceededResult.adjustedTime * 60000;
                                urlTimes[trackingUrl] = accumulatedTime[trackingUrl];
                                urlAccumulatedTimes[trackingUrl] = accumulatedTime[trackingUrl];
                                
                                // Save the adjusted time to Chrome Storage
                                await setState('blockerUrlTimes', urlTimes);
                                await setState('blockerUrlAccumulatedTimes', urlAccumulatedTimes);
                                
                                console.log('Time limit reached:', {
                                    originalTime: currentTimeMinutes,
                                    adjustedTime: timeExceededResult.adjustedTime,
                                    limitTime: totalTimeLimitMinutes,
                                    url: trackingUrl
                                });

                                // For local storage, update the URL to be visited
                                await updateLocalStorageBlockedState(trackingUrl, true);
                                
                                // Send WebSocket update for blocked state change
                                try {
                                    const updatedUrlData = {
                                        ...matchingElement,
                                        visited: "true",
                                        used_time: timeExceededResult.adjustedTime.toFixed(2),
                                        time: timeExceededResult.adjustedTime.toFixed(2),
                                        half_time_notified: "true",
                                        one_quarter_notified: "true",
                                        three_quarter_notified: "true"
                                    };
                                    
                                    // Update WebSocket cache and notify
                                    webSocketApiService.updateCachedUrl(updatedUrlData);
                                    
                                    // Send message to notify Options page
                                    chrome.runtime.sendMessage({
                                        type: 'WEBSITE_BLOCKED',
                                        data: {
                                            url: updatedUrlData,
                                            timestamp: Date.now()
                                        }
                                    }).catch(() => {
                                        // Ignore errors - Options page may not be open
                                    });
                                    
                                    console.log('Sent blocked state notification for:', matchingElement.block_urls);
                                } catch (wsError) {
                                    console.error('Error sending WebSocket blocked notification:', wsError);
                                }

                                // First, check if we've already redirected recently
                                if (await redirectManager.hasRecentRedirect(matchingElement.block_urls)) {
                                    console.log("Skipping time limit action because recent redirect exists:", matchingElement.block_urls);
                                } else {
                                    // Acquire a lock for this URL
                                    const lockAcquired = redirectManager.acquireLock(matchingElement.block_urls);
                                    console.log(`Lock acquisition for ${matchingElement.block_urls}: ${lockAcquired ? 'SUCCESS' : 'FAILED'}`);
                                    
                                    if (lockAcquired) {
                                        try {
                                            // Set a flag in sessionStorage to prevent double redirects
                                            // This will prevent navigation handler from also doing a redirect
                                            redirectManager.setUrlRedirected(matchingElement.block_urls, true);
                                            
                                            // Record the redirect immediately to prevent race conditions
                                            await redirectManager.recordRedirect(matchingElement.block_urls);
                                        
                                            // First mark the URL as visited in storage
                                            await updateLocalStorageBlockedState(trackingUrl, true);
                                            
                                            // Block all tabs that match this URL pattern
                                            const { blockAllMatchingTabs } = await import('./navigationHandler');
                                            await blockAllMatchingTabs(matchingElement.block_urls, matchingElement);
                                            
                                            // Handle redirect tab creation if needed
                                            if (matchingElement.redirect_urls) {
                                                const redirectUrl = matchingElement.redirect_urls.startsWith("http")
                                                    ? matchingElement.redirect_urls
                                                    : `https://www.${matchingElement.redirect_urls.replace(/^www\./, "")}`;
                                                
                                                console.log(`Opening redirect URL: ${redirectUrl}`);
                                                
                                                // Create the redirect tab
                                                await chrome.tabs.create({ url: redirectUrl });
                                                console.log(`Created redirect tab for ${matchingElement.block_urls}`);
                                            }
                                        } catch (error) {
                                            console.error("Error handling time limit:", error);
                                            // Make sure to release locks and flags on error
                                            redirectManager.setRedirectInProgress(false);
                                            redirectManager.releaseLock(matchingElement.block_urls);
                                        }
                                    }
                                }

                                if (matchingElement.is_temporary) {
                                    // Set temporary_time to default_time when temporary time expires
                                    await setTemporaryTimeToDefaultTime(matchingElement.id, matchingElement.default_time);
                                    await reset_Time(matchingElement.id);
                                }

                                await updateApiAndResetStates(
                                    matchingElement, 
                                    trackingUrl,
                                    urlTimes,
                                    urlAccumulatedTimes,
                                    tabTimes,
                                    notificationStates,
                                    urlStateTransitions,
                                    accumulatedTime,
                                    activeTabId,
                                    redirectManager
                                );
                                return;
                            }
                        }
                        
                        // No need to automatically reset pause state - only done via user interaction now
                        // This ensures time tracking stays paused until user explicitly chooses to continue
                    }
                } else {
                    // Not a matching element or visited
                    // Only clear pause state if it's not due to a notification
                    if (pauseReason !== "notification" && pauseReason !== "notification_50" && pauseReason !== "notification_75") {
                        isPaused = false;
                        pauseReason = "";
                    }
                }
    
                lastCheckTime = currentTime;
            } catch (error) {
                console.error("Error in interval check:", error);
            }
        }
    }

    // Start the timer
    setInterval(checkTime, DEFAULT_CHECK_INTERVAL);
    
    // Store the controller so other functions can access it
    timeTrackerController = {
        setPaused: (value, reason = "") => { 
            isPaused = value; 
            pauseReason = reason;
            console.log(`Time tracking ${value ? "paused" : "resumed"}${reason ? " due to " + reason : ""}`);
        },
        isPaused: () => isPaused,
        getPauseReason: () => pauseReason,
        checkTime,
        resetCheckTime: () => { lastCheckTime = Date.now(); }
    };
    
    return timeTrackerController;
}

// Export the time tracker controller for external access
export function getTimeTrackerController() {
    return timeTrackerController;
}

// Helper function to update local storage URL time for non-authenticated users
async function updateLocalStorageTime(trackingUrl, timeInMs) {
    const getAccessToken = (await import('./storage')).getAccessToken;
    
    if (!await getAccessToken()) {
        const blockedUrls = await (await import('./storage')).getBlockedUrlsFromStorage();
        const urlIndex = blockedUrls.findIndex(url => 
            normalizeUrl(url.block_urls) === trackingUrl
        );
        
        if (urlIndex !== -1) {
            // Update used_time
            blockedUrls[urlIndex].used_time = (timeInMs / 60000).toFixed(2);
            // Keep backward compatibility
            blockedUrls[urlIndex].time = (timeInMs / 60000).toFixed(2);
            
            // Update temporary_time if it exists and is being used
            if (blockedUrls[urlIndex].is_temporary && blockedUrls[urlIndex].temporary_time) {
                // Keep temporary_time as is - it's the limit, not the used time
                console.log(`Preserving temporary_time: ${blockedUrls[urlIndex].temporary_time} minutes`);
            }
            
            // Save back to storage
            await new Promise(resolve => {
                chrome.storage.local.set({ 'blocked_urls': blockedUrls }, resolve);
            });
        }
    }
}

// Helper function to update local storage notification state
async function updateLocalStorageNotificationState(trackingUrl, notificationType, value) {
    const getAccessToken = (await import('./storage')).getAccessToken;
    
    if (!await getAccessToken()) {
        const blockedUrls = await (await import('./storage')).getBlockedUrlsFromStorage();
        const urlIndex = blockedUrls.findIndex(url => 
            normalizeUrl(url.block_urls) === trackingUrl
        );
        
        if (urlIndex !== -1) {
            blockedUrls[urlIndex][notificationType] = value.toString();
            
            // Save back to storage
            await new Promise(resolve => {
                chrome.storage.local.set({ 'blocked_urls': blockedUrls }, resolve);
            });
        }
    }
}

// Helper function to update local storage blocked state
async function updateLocalStorageBlockedState(trackingUrl, isBlocked) {
    const getAccessToken = (await import('./storage')).getAccessToken;
    
    if (!await getAccessToken()) {
        const blockedUrls = await (await import('./storage')).getBlockedUrlsFromStorage();
        const urlIndex = blockedUrls.findIndex(url => 
            normalizeUrl(url.block_urls) === trackingUrl
        );
        
        if (urlIndex !== -1) {
            // Update visited and notification states
            blockedUrls[urlIndex].visited = isBlocked.toString();
            blockedUrls[urlIndex].half_time_notified = "true";
            blockedUrls[urlIndex].one_quarter_notified = "true";
            blockedUrls[urlIndex].three_quarter_notified = "true";
            
            // Set today_limit to current time limit when site gets blocked
            if (isBlocked) {
                const currentTimeLimit = blockedUrls[urlIndex].is_temporary ? 
                    blockedUrls[urlIndex].temporary_time : blockedUrls[urlIndex].default_time;
                blockedUrls[urlIndex].today_limit = currentTimeLimit;
            }
            
            // If temporary and now blocked, handle temporary_time
            if (blockedUrls[urlIndex].is_temporary === true || blockedUrls[urlIndex].is_temporary === "true") {
                if (isBlocked) {
                    // Keep temporary_time for reference but update minutes_to_unblock
                    if (blockedUrls[urlIndex].temporary_time) {
                        blockedUrls[urlIndex].minutes_to_unblock = blockedUrls[urlIndex].temporary_time;
                    } else if (blockedUrls[urlIndex].default_time) {
                        blockedUrls[urlIndex].minutes_to_unblock = blockedUrls[urlIndex].default_time;
                    }
                    // Keep is_temporary as true to maintain the temporary nature
                }
            }
            
            // Save back to storage
            await new Promise(resolve => {
                chrome.storage.local.set({ 'blocked_urls': blockedUrls }, resolve);
            });
            
            // If blocking, reload matching tabs to show blocked page
            if (isBlocked) {
                const blockUrl = blockedUrls[urlIndex].block_urls;
                chrome.tabs.query({}, (tabs) => {
                    tabs.forEach(tab => {
                        if (tab.url && tab.url.includes(blockUrl)) {
                            chrome.tabs.reload(tab.id);
                        }
                    });
                });
                console.log(`Local URL blocked and tabs reloaded: ${blockUrl}`);
            }
        }
    }
}

// Get tracking URL for a given tab URL
async function getTrackingUrl(currentUrl) {
    // Import needed functions
    const { normalizeUrl } = await import('./urlUtils');
    const { fetchUrls } = await import('./apiService');
    const { compareUrls } = await import('./urlUtils');
    
    try {
        // Validate input URL
        if (!currentUrl || typeof currentUrl !== 'string' || currentUrl.trim() === '') {
            console.warn('Invalid URL passed to getTrackingUrl:', currentUrl);
            return null;
        }
        
        // Get the URLs list from storage/state
        const urls = await fetchUrls();
        if (!urls || !Array.isArray(urls)) return normalizeUrl(currentUrl);

        // Find matching block URL based on compareUrls logic
        const matchingElement = urls.find((element) => {
            return compareUrls(element.block_urls, currentUrl);
        });

        // If there's a match, use the block URL as tracking URL
        if (matchingElement) {
            return normalizeUrl(matchingElement.block_urls);
        }

        // If no match found, return normalized current URL
        return normalizeUrl(currentUrl);
    } catch (error) {
        console.error("Error in getTrackingUrl:", error);
        return currentUrl ? normalizeUrl(currentUrl) : null;
    }
}