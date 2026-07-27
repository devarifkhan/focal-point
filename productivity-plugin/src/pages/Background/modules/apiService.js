import { getAccessToken, getBlockedUrlsFromStorage, setState } from './storage';
import { normalizeUrl } from './urlUtils';
import { API_BASE_URL } from '../constants/contants';
import { handleUrlStateUpdate } from './stateManager';
import webSocketApiService from '../../../services/WebSocketApiService.js';
import ApiUrlServices from '../../../networks/ApiUrlServices.js';

// Helper function to process URLs data from API or WebSocket
async function processUrlsData(urls) {
    // Ensure timezone is present for API data
    const defaultTimezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    const urlsWithTimezone = urls.map(url => ({
        ...url,
        timezone: url.timezone || defaultTimezone
    }));
    
    // Handle each URL's state update
    await Promise.all(urlsWithTimezone.map(async (urlData) => {
        // Import redirectManager to check if this URL was recently deleted
        const redirectManager = (await import('./redirectManager')).default;
        
        // Check if this URL was recently deleted and should have its states reset
        if (redirectManager.shouldResetNotificationStates(urlData.block_urls)) {
            console.log(`Resetting states for recently re-added URL: ${urlData.block_urls}`);
            
            // Check if this URL should be immediately blocked (0-minute time limit)
            const timeLimit = parseFloat(urlData.temporary_time || urlData.default_time || urlData.today_limit || 0);
            const shouldBeBlocked = timeLimit === 0;
            
            // Reset the URL data states completely
            urlData.used_time = "0.00";
            urlData.time = "0.00"; // Keep for backward compatibility
            urlData.visited = shouldBeBlocked ? "true" : "false"; // Set visited based on time limit
            urlData.half_time_notified = "false";
            urlData.one_quarter_notified = "false";
            urlData.three_quarter_notified = "false";
            
            console.log(`Reset URL ${urlData.block_urls}: timeLimit=${timeLimit}, shouldBeBlocked=${shouldBeBlocked}, visited=${urlData.visited}`);
            
            // Clear the reset flag since we've processed it
            redirectManager.clearResetFlag(urlData.block_urls);
        }
        
        return handleUrlStateUpdate(urlData, true); // Pass true to indicate this is from sync
    }));
    
    return urlsWithTimezone;
}

// Update URL data in the API or local storage
export async function updateUrl(id, formData) {
    try {
        let token = await getAccessToken();
        
        if (token) {
            // Get current URL data to preserve is_temporary, default_time, and timezone
            const urls = await fetchUrls();
            const currentUrl = urls.find(url => url.id === id);
            
            // Preserve is_temporary, default_time, temporary_time, and timezone if they exist
            if (currentUrl) {
                if (currentUrl.is_temporary !== undefined) {
                    formData.append("is_temporary", currentUrl.is_temporary.toString());
                }
                if (currentUrl.default_time !== undefined) {
                    formData.append("default_time", currentUrl.default_time.toString());
                }
                if (currentUrl.temporary_time !== undefined) {
                    formData.append("temporary_time", currentUrl.temporary_time.toString());
                }
                if (currentUrl.timezone) {
                    formData.append("timezone", currentUrl.timezone);
                }
            }

            // Update via WebSocket
            await webSocketApiService.updateUrl(id, formData);
            console.log('URL updated via WebSocket');
            
            // Return success response in expected format
            return { success: true, data: { urls: [currentUrl] } };
        } else {
            // Non-authenticated user - use local storage
            const blockedUrls = await getBlockedUrlsFromStorage();
            
            // Convert formData to a regular object
            const updatedData = {};
            for (let pair of formData.entries()) {
                updatedData[pair[0]] = pair[1];
            }
            
            // Find the URL to update
            const urlIndex = blockedUrls.findIndex(url => url.id === id);
            
            if (urlIndex !== -1) {
                // Get the current URL data
                const currentUrl = blockedUrls[urlIndex];
                
                // Update the URL data while preserving is_temporary, default_time, temporary_time, and timezone
                const defaultTimezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
                const updatedUrl = {
                    ...blockedUrls[urlIndex],
                    ...updatedData,
                    is_temporary: currentUrl.is_temporary, // Preserve is_temporary
                    default_time: currentUrl.default_time, // Preserve default_time
                    temporary_time: currentUrl.temporary_time, // Preserve temporary_time
                    timezone: currentUrl.timezone || defaultTimezone, // Preserve or set timezone
                    updated_at: new Date().toISOString()
                };
                
                blockedUrls[urlIndex] = updatedUrl;
                
                // Save back to storage
                await new Promise((resolve) => {
                    chrome.storage.local.set({ 'blocked_urls': blockedUrls }, resolve);
                });
                
                // Handle URL state update
                await handleUrlStateUpdate(updatedUrl);
                
                return { success: true, data: { urls: [updatedUrl] } };
            } else {
                throw new Error("URL not found");
            }
        }
    } catch (error) {
        console.error("Error updating URL:", error);
        throw error;
    }
}

// Set temporary_time to default_time when temporary time expires
export async function setTemporaryTimeToDefaultTime(id, defaultTime) {
    try {
        let token = await getAccessToken();
        
        if (token) {
            // Authenticated user - use API
            const formData = new FormData();
            formData.append("temporary_time", defaultTime.toString());
            
            const response = await fetch(`${API_BASE_URL}/urls/update_url/${id}`, {
                method: "PUT",
                headers: {
                    Authorization: `Bearer ${token}`,
                },
                body: formData,
            });

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            
            return response.json();
        } else {
            // Non-authenticated user - use local storage
            const blockedUrls = await getBlockedUrlsFromStorage();
            
            // Find the URL to update
            const urlIndex = blockedUrls.findIndex(url => url.id === id);
            
            if (urlIndex !== -1) {
                // Update temporary_time to default_time
                blockedUrls[urlIndex].temporary_time = defaultTime.toString();
                blockedUrls[urlIndex].updated_at = new Date().toISOString();
                
                // Save back to storage
                await new Promise((resolve) => {
                    chrome.storage.local.set({ 'blocked_urls': blockedUrls }, resolve);
                });
                
                return { success: true, data: { url: blockedUrls[urlIndex] } };
            } else {
                throw new Error("URL not found");
            }
        }
    } catch (error) {
        console.error("Error setting temporary time to default time:", error);
        throw error;
    }
}

// Reset time for a URL
export async function reset_Time(id) {
    try {
        let token = await getAccessToken();
        
        if (token) {
            // Get the current URL data to preserve is_temporary
            const urls = await fetchUrls();
            const currentUrl = urls.find(url => url.id === id);
            const isTemporary = currentUrl?.is_temporary || false;

            // Authenticated user - use API
            const response = await fetch(`${API_BASE_URL}/urls/reset_time/${id}`, {
                method: "PUT",
                headers: {
                    Authorization: `Bearer ${token}`,
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({ is_temporary: isTemporary }),
            });

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            
            return response.json();
        } else {
            // Non-authenticated user - use local storage
            const blockedUrls = await getBlockedUrlsFromStorage();
            
            // Find the URL to reset
            const urlIndex = blockedUrls.findIndex(url => url.id === id);
            
            if (urlIndex !== -1) {
                // Reset the URL data while preserving is_temporary, temporary_time, and timezone
                const defaultTimezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
                const updatedUrl = {
                    ...blockedUrls[urlIndex],
                    used_time: 0,
                    time: 0, // Keep for backward compatibility
                    half_time_notified: "false",
                    one_quarter_notified: "false",
                    three_quarter_notified: "false",
                    visited: "false",
                    timezone: blockedUrls[urlIndex].timezone || defaultTimezone, // Preserve or set timezone
                    updated_at: new Date().toISOString()
                };
                
                blockedUrls[urlIndex] = updatedUrl;
                
                // Save back to storage
                await new Promise((resolve) => {
                    chrome.storage.local.set({ 'blocked_urls': blockedUrls }, resolve);
                });
                
                // Handle URL state update - this will properly reset states
                await handleUrlStateUpdate(updatedUrl);
                
                return { success: true, data: { url: updatedUrl } };
            } else {
                throw new Error("URL not found");
            }
        }
    } catch (error) {
        console.error("Error resetting URL time:", error);
        throw error;
    }
}

// Fetch all URLs from API or local storage
export async function fetchUrls() {
    try {
        // First check if we have a token
        const token = await getAccessToken();
        
        if (token) {
            // Initialize WebSocket service if not already done
            await webSocketApiService.initialize();
            
            // Get URLs via WebSocket (returns cached data immediately)
            const urls = await webSocketApiService.fetchUrls();
            
            if (urls && Array.isArray(urls)) {
                console.log('URLs fetched via WebSocket:', urls.length);
                return await processUrlsData(urls);
            }
            
            return [];
        } else {
            // Non-authenticated user - get from local storage
            const blockedUrls = await getBlockedUrlsFromStorage();
            
            // Process each URL like we would with API data
            if (blockedUrls.length > 0) {
                await Promise.all(blockedUrls.map(async (urlData) => {
                    // Import redirectManager to check if this URL was recently deleted
                    const redirectManager = (await import('./redirectManager')).default;
                    
                    // Check if this URL was recently deleted and should have its states reset
                    if (redirectManager.shouldResetNotificationStates(urlData.block_urls)) {
                        console.log(`Resetting states for recently re-added local URL: ${urlData.block_urls}`);
                        
                        // Check if this URL should be immediately blocked (0-minute time limit)
                        const timeLimit = parseFloat(urlData.temporary_time || urlData.default_time || urlData.today_limit || 0);
                        const shouldBeBlocked = timeLimit === 0;
                        
                        // Reset the URL data states completely
                        urlData.used_time = "0.00";
                        urlData.time = "0.00"; // Keep for backward compatibility
                        urlData.visited = shouldBeBlocked ? "true" : "false"; // Set visited based on time limit
                        urlData.half_time_notified = "false";
                        urlData.one_quarter_notified = "false";
                        urlData.three_quarter_notified = "false";
                        
                        console.log(`Reset local URL ${urlData.block_urls}: timeLimit=${timeLimit}, shouldBeBlocked=${shouldBeBlocked}, visited=${urlData.visited}`);
                        
                        // Update the local storage with reset values
                        try {
                            const currentBlockedUrls = await getBlockedUrlsFromStorage();
                            const urlIndex = currentBlockedUrls.findIndex(url => url.id === urlData.id);
                            if (urlIndex !== -1) {
                                currentBlockedUrls[urlIndex] = { ...currentBlockedUrls[urlIndex], ...urlData };
                                await new Promise(resolve => {
                                    chrome.storage.local.set({ 'blocked_urls': currentBlockedUrls }, resolve);
                                });
                            }
                        } catch (updateError) {
                            console.error('Error updating local storage after reset:', updateError);
                        }
                        
                        // Clear the reset flag since we've processed it
                        redirectManager.clearResetFlag(urlData.block_urls);
                    }
                    
                    return handleUrlStateUpdate(urlData, true); // Pass true for local storage processing
                }));
            }
            
            return blockedUrls;
        }
    } catch (error) {
        console.error("Error fetching URLs:", error);
        
        // As a fallback, try to get from local storage even if API fails
        return await getBlockedUrlsFromStorage();
    }
}

// Fetch state for a specific URL from API
export async function fetchUrlStateFromAPI(url) {
    try {
        let token = await getAccessToken();
        const response = await fetch(`${API_BASE_URL}/urls/retrive_urls_list`, {
            method: "GET",
            headers: {
                Authorization: `Bearer ${token}`,
                "Content-Type": "application/json",
            }
        });

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        const responseData = await response.json();

        if (responseData.success && responseData.data && responseData.data.urls) {
            const normalizedUrl = normalizeUrl(url);
            const urlData = responseData.data.urls.find(item =>
                normalizeUrl(item.block_urls) === normalizedUrl
            );

            return urlData || null;
        }

        return null;
    } catch (error) {
        console.error("Error fetching URL state from API:", error);
        return null;
    }
}

// Update notification state for a URL
export async function updateNotificationState(id, notificationType, timeSpentMinutes, includeHalfTime = false) {
    try {
        // Check if user is logged out
        const token = await getAccessToken();
        
        if (!token) {
            // For logged out users, update local storage immediately
            const blockedUrls = await getBlockedUrlsFromStorage();
            const urlIndex = blockedUrls.findIndex(url => url.id === id);
            
            if (urlIndex !== -1) {
                // Update notification states in local storage
                blockedUrls[urlIndex][notificationType] = "true";
                if (includeHalfTime) {
                    blockedUrls[urlIndex].half_time_notified = "true";
                }
                // blockedUrls[urlIndex].used_time = parseFloat(timeSpentMinutes).toFixed(2);
                // blockedUrls[urlIndex].time = parseFloat(timeSpentMinutes).toFixed(2); // Keep for backward compatibility
                // blockedUrls[urlIndex].updated_at = new Date().toISOString();
                
                // Save back to storage immediately
                await new Promise((resolve) => {
                    chrome.storage.local.set({ 'blocked_urls': blockedUrls }, resolve);
                });
                
                console.log(`Updated notification state for logged out user: ${notificationType} = true for URL ID ${id}`);
                return;
            }
        }
        
        // For logged in users, use the regular API update
        const urls = await fetchUrls();
        const currentUrl = urls.find(url => url.id === id);
        const isTemporary = currentUrl?.is_temporary || false;

        const formData = new FormData();
        formData.append(notificationType, "true");
        if (includeHalfTime) {
            formData.append("half_time_notified", "true");
        }
        formData.append("used_time", parseFloat(timeSpentMinutes));
        formData.append("time", parseFloat(timeSpentMinutes)); // Keep for backward compatibility
        formData.append("is_temporary", isTemporary.toString());
        await updateUrl(id, formData);
    } catch (error) {
        console.error("Error in updateNotificationState:", error);
        throw error;
    }
}

// Update API and reset states after time limit reached
export async function updateApiAndResetStates(matchingElement, normalizedUrl, urlTimes, urlAccumulatedTimes, tabTimes, 
                                           notificationStates, urlStateTransitions, accumulatedTime, 
                                           activeTabId, redirectManager) {
    const updatedData = {
        half_time_notified: true,
        one_quarter_notified: true,
        three_quarter_notified: true,
        visited: true,
    };

    const usedTimeMinutes = parseFloat((urlTimes[normalizedUrl] / 60000).toFixed(2));
    
    const formData = new FormData();
    formData.append("visited", updatedData.visited.toString());
    formData.append("used_time", usedTimeMinutes);
    formData.append("time", usedTimeMinutes); // Keep for backward compatibility
    formData.append("half_time_notified", updatedData.half_time_notified.toString());
    formData.append("one_quarter_notified", updatedData.one_quarter_notified.toString());
    formData.append("three_quarter_notified", updatedData.three_quarter_notified.toString());
    // Set today_limit to current time limit when blocking
    const currentTimeLimit = matchingElement.is_temporary ? matchingElement.temporary_time : matchingElement.default_time;
    formData.append("today_limit", currentTimeLimit);

    await updateUrl(matchingElement.id, formData);

    // Reset states - this will be handled by stateManager
    await resetUrlState(matchingElement.block_urls, { 
        urlTimes, 
        urlAccumulatedTimes, 
        tabTimes, 
        accumulatedTime, 
        notificationStates, 
        urlStateTransitions,
        activeTabId,
        redirectManager
    });
}

// Reset state for a URL
export async function resetUrlState(url, stateObjects) {
    const { 
        urlTimes, 
        urlAccumulatedTimes, 
        tabTimes, 
        accumulatedTime, 
        notificationStates, 
        urlStateTransitions,
        activeTabId,
        redirectManager
    } = stateObjects;
    
    const normalizedUrl = normalizeUrl(url);
    
    // Reset all time tracking
    urlTimes[normalizedUrl] = 0;
    urlAccumulatedTimes[normalizedUrl] = 0;
    if (accumulatedTime[normalizedUrl]) {
        accumulatedTime[normalizedUrl] = 0;
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
    
    // Reset redirect counts for this URL
    await redirectManager.resetRedirectCount(url);
    
    // Save to Chrome Storage
    await saveStates({
        urlTimes, 
        urlAccumulatedTimes, 
        tabTimes,
        notificationStates, 
        urlStateTransitions
    });
    
    // If this URL is the active tab, reset its timer and reload
    if (activeTabId) {
        try {
            const activeTab = await chrome.tabs.get(activeTabId);
            // Only reload if URL matches - this should be done by the caller
        } catch (error) {
            console.error("Error checking active tab during reset:", error);
        }
    }
    
    // Clean up any redirect data
    await redirectManager.cleanup();
}

// Reset all URLs for cloud users with timezone support
export async function resetAllUrlsCloud() {
    try {
        const token = await getAccessToken();
        if (!token) {
            throw new Error('No authentication token available');
        }

        const userTimezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
        
        const response = await fetch(`${API_BASE_URL}${ApiUrlServices.RESET_ALL_URLS}`, {
            method: "POST",
            headers: {
                Authorization: `Bearer ${token}`,
                "Content-Type": "application/json",
            },
            body: JSON.stringify({ timezone: userTimezone })
        });

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        const result = await response.json();
        
        // Save the reset timestamp for cloud users too
        const resetTimestamp = Date.now();
        await setState('lastResetTime', resetTimestamp);
        console.log(`Cloud reset timestamp saved: ${new Date(resetTimestamp).toLocaleString()}`);
        
        // Clear additionalTime cache
        const { clearBaseTimeCache } = await import('./timeTracker');
        clearBaseTimeCache();
        
        // Reset local state after successful cloud reset
        const { scheduledResetAllUrlsLocal } = await import('./stateManager');
        await scheduledResetAllUrlsLocal();
        
        // Fetch latest data from server after reset
        await fetchUrls();
        
        return result;
    } catch (error) {
        console.error("Error resetting all URLs for cloud user:", error);
        throw error;
    }
}

// Helper function to save all state objects to storage 
async function saveStates({ urlTimes, urlAccumulatedTimes, tabTimes, notificationStates, urlStateTransitions }) {
    // Import these here to avoid circular dependencies
    const { STORAGE_KEYS } = await import('./storage');
    const { saveMapToStorage } = await import('./storage');
    const { setState } = await import('./storage');
    
    // Use Promise.all to save all states concurrently
    await Promise.all([
        setState(STORAGE_KEYS.URL_TIMES, urlTimes),
        setState(STORAGE_KEYS.URL_ACCUMULATED_TIMES, urlAccumulatedTimes),
        setState(STORAGE_KEYS.TAB_TIMES, tabTimes),
        setState(STORAGE_KEYS.NOTIFICATION_STATES, notificationStates),
        saveMapToStorage(urlStateTransitions, STORAGE_KEYS.URL_STATE_TRANSITIONS)
    ]);
}