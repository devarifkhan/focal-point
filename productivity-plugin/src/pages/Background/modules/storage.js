// Storage keys used throughout the extension
export const STORAGE_KEYS = {
    TAB_TIMES: 'blockerTabTimes',
    URL_TIMES: 'blockerUrlTimes',
    URL_ACCUMULATED_TIMES: 'blockerUrlAccumulatedTimes',
    NOTIFICATION_STATES: 'blockerNotificationStates',
    REDIRECTED_URLS: 'blockerRedirectedUrls',
    URL_STATE_TRANSITIONS: 'blockerUrlStateTransitions'
};

// Get state from Chrome storage
export async function getState(key, defaultValue = {}) {
    return new Promise((resolve) => {
        chrome.storage.local.get(key, (result) => {
            resolve(result[key] || defaultValue);
        });
    });
}

// Set state in Chrome storage
export async function setState(key, value) {
    return new Promise((resolve) => {
        chrome.storage.local.set({ [key]: value }, resolve);
    });
}

// Save Map to storage (converting to object)
export async function saveMapToStorage(map, key) {
    console.log("Saving map to storage:", map, key);
    await setState(key, Object.fromEntries(map));
}

// Get access token from storage
export async function getAccessToken() {
    return new Promise((resolve, reject) => {
        chrome.storage.local.get("access_token", (result) => {
            if (chrome.runtime.lastError) {
                reject(chrome.runtime.lastError);
            } else {
                resolve(result.access_token);
            }
        });
    });
}

// Get blocked URLs from storage
export async function getBlockedUrlsFromStorage() {
    return new Promise((resolve) => {
        chrome.storage.local.get('blocked_urls', (result) => {
            const blockedUrls = result.blocked_urls || [];
            const defaultTimezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
            
            // Ensure all URLs have timezone
            const urlsWithTimezone = blockedUrls.map(url => ({
                ...url,
                timezone: url.timezone || defaultTimezone
            }));
            
            resolve(urlsWithTimezone);
        });
    });
}