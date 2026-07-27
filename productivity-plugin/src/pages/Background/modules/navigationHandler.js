import { compareUrls, createBlockRegex } from './urlUtils';
import redirectManager from './redirectManager';
import { injectContentScript, sendMessageToTab, markTabAsReloaded, wasTabRecentlyReloaded } from './timeTracker';

// Handle navigation to blocked URLs
export async function handleNavigation(details, urls) {
    if (details.frameId !== 0) return;

    // Never block extension pages
    if (details.url && (details.url.startsWith('chrome-extension://') || 
                       details.url.startsWith('moz-extension://') || 
                       details.url.startsWith('extension://'))) {
        console.log("Extension URL detected, skipping navigation handler:", details.url);
        return;
    }

    try {
        console.log("Navigation detected:", details.url);
        const allTabs = await chrome.tabs.query({});
        let redirectToApply = null;

        for (const element of urls) {
            // Convert visited to string for consistent comparison
            const visited = typeof element.visited === 'boolean' 
                ? element.visited.toString() 
                : element.visited || "false";
            
            console.log("Checking URL:", element.block_urls, "visited:", visited);
            
            // First try exact URL comparison
            const isCurrentUrlBlocked = compareUrls(element.block_urls, details.url);
            
            console.log("Current URL blocked status:", isCurrentUrlBlocked);
            
            // Only proceed if the URL is actually visited/blocked according to server
            if (visited !== "true") {
                console.log("URL not blocked according to server, skipping:", element.block_urls);
                continue;
            }

            if (isCurrentUrlBlocked) {
                console.log("Current URL matches block pattern, handling block...");
                const tab = await chrome.tabs.get(details.tabId);
                
                if (!tab) {
                    console.error("Tab not found:", details.tabId);
                    continue;
                }

                try {
                    // First check if content script is already injected
                    try {
                        await chrome.tabs.sendMessage(tab.id, { type: 'PING' });
                        console.log("Content script already exists in tab:", tab.id);
                    } catch (e) {
                        // Content script not found, inject it
                        console.log("Injecting content script into tab:", tab.id);
                        await chrome.scripting.executeScript({
                            target: { tabId: tab.id },
                            files: ["contentScript.bundle.js"]
                        });
                        
                        // Wait a moment for the script to initialize
                        await new Promise(resolve => setTimeout(resolve, 100));
                    }

                    // Send the block message
                    console.log("Sending block message to tab:", tab.id);
                    const response = await chrome.tabs.sendMessage(tab.id, {
                        message: true,
                        tabId: tab.id,
                        url: tab.url,
                        redirectUrl: element.redirect_urls || '',
                        customMessage: element.message || '',
                        image: element.image || '',
                        visited: visited
                    });
                    
                    console.log("Block message response:", response);

                    // Handle redirect if configured
                    if (visited === "true" &&
                        element.redirect_urls?.length > 0 &&
                        !(await redirectManager.hasRecentRedirect(element.block_urls)) &&
                        element.time >= element.minutes_to_unblock) {
                        
                        console.log("Setting up redirect for:", element.block_urls, element.redirect_urls);
                        redirectToApply = {
                            blockUrls: element.block_urls,
                            redirectUrl: element.redirect_urls.startsWith("http")
                                ? element.redirect_urls
                                : `https://www.${element.redirect_urls.replace(/^www\./, "")}`
                        };
                    }
                } catch (error) {
                    console.error("Error handling block for tab:", tab.id, error);
                    
                    // If content script injection failed, try reloading the tab and retry
                    try {
                        console.log("Attempting to reload tab and retry:", tab.id);
                        
                        // Only reload if not recently reloaded
                        if (!wasTabRecentlyReloaded(tab.id)) {
                            markTabAsReloaded(tab.id);
                            await chrome.tabs.reload(tab.id, { bypassCache: true });
                            
                            // Wait a moment for the reload
                            await new Promise(resolve => setTimeout(resolve, 1000));
                            
                            // Try injection again
                            await chrome.scripting.executeScript({
                                target: { tabId: tab.id },
                                files: ["contentScript.bundle.js"]
                            });
                            
                            // Send the message again
                            await chrome.tabs.sendMessage(tab.id, {
                                message: true,
                                tabId: tab.id,
                                url: tab.url,
                                redirectUrl: element.redirect_urls || '',
                                customMessage: element.message || '',
                                image: element.image || '',
                                visited: visited
                            });
                        } else {
                            console.log("Tab was recently reloaded, skipping reload:", tab.id);
                        }
                    } catch (retryError) {
                        console.error("Retry failed for tab:", tab.id, retryError);
                    }
                }
            }
        }

        // Apply redirect only if we found a matching pattern for the current navigation
        if (redirectToApply) {
            // First check if URL is already being redirected (from time tracker)
            if (redirectManager.isUrlRedirected(redirectToApply.blockUrls)) {
                console.log("Skipping redirect in handleNavigation because URL is already being redirected:", redirectToApply.blockUrls);
                return;
            }
            
            // Try to acquire lock first
            if (!redirectManager.acquireLock(redirectToApply.blockUrls)) {
                console.log("Skipping redirect in handleNavigation because lock could not be acquired:", redirectToApply.blockUrls);
                return;
            }
            
            // Record redirect before creating new tab
            await redirectManager.recordRedirect(redirectToApply.blockUrls);

            // Create new tab with redirect URL
            await chrome.tabs.create({ url: redirectToApply.redirectUrl });
            
            // Mark URL as redirected after creating the tab to prevent duplicate redirects
            redirectManager.setUrlRedirected(redirectToApply.blockUrls, true);
            console.log(`Marked ${redirectToApply.blockUrls} as redirected after creating tab`);
        }
    } catch (err) {
        console.error("Error in navigation handler:", err);
    }
}

// Block all tabs matching a regex pattern
export async function blockAllMatchingTabs(blockUrl, element) {
    try {
        console.log(`Blocking all tabs matching pattern for: ${blockUrl}`);
        
        // Create pattern to match URLs
        const blockPattern = createBlockRegex(blockUrl);
        
        // Get all open tabs
        const allTabs = await chrome.tabs.query({});
        
        // Filter tabs that match the block pattern
        const matchingTabs = allTabs.filter(tab => blockPattern.test(tab.url));
        
        if (matchingTabs.length === 0) {
            console.log("No matching tabs found to block");
            return;
        }
        
        console.log(`Found ${matchingTabs.length} tabs matching ${blockUrl} to block`);
        
        // Process each matching tab
        await Promise.all(matchingTabs.map(async (tab) => {
            // Skip tabs that were recently reloaded to prevent reload loops
            if (wasTabRecentlyReloaded(tab.id)) {
                console.log(`Tab ${tab.id} was recently reloaded, skipping`);
                return;
            }
            
            // Mark tab as reloaded first to prevent multiple reloads
            markTabAsReloaded(tab.id);
            
            try {
                // First check if content script is already injected
                try {
                    const response = await chrome.tabs.sendMessage(tab.id, { type: 'PING' }).catch(() => null);
                    
                    if (response && response.status === 'alive') {
                        // Content script is already active, send block message directly
                        console.log(`Content script is active in tab ${tab.id}, sending block message`);
                        await chrome.tabs.sendMessage(tab.id, {
                            message: true,
                            tabId: tab.id,
                            url: tab.url,
                            redirectUrl: element.redirect_urls || '',
                            customMessage: element.message || '',
                            image: element.image || '',
                            visited: "true"
                        });
                    } else {
                        // Content script not active, inject it
                        console.log(`Content script not active in tab ${tab.id}, injecting`);
                        await injectContentScript(tab.id);
                        
                        // Wait a moment for script to initialize
                        await new Promise(resolve => setTimeout(resolve, 100));
                        
                        // Send the block message
                        await chrome.tabs.sendMessage(tab.id, {
                            message: true,
                            tabId: tab.id,
                            url: tab.url,
                            redirectUrl: element.redirect_urls || '',
                            customMessage: element.message || '',
                            image: element.image || '',
                            visited: "true"
                        });
                    }
                } catch (error) {
                    console.error(`Error injecting content script into tab ${tab.id}:`, error);
                    
                    // Fallback to reloading the tab
                    console.log(`Reloading tab ${tab.id} as fallback`);
                    await chrome.tabs.reload(tab.id, { bypassCache: true });
                }
                
                console.log(`Successfully blocked tab ${tab.id}`);
            } catch (error) {
                console.error(`Error blocking tab ${tab.id}:`, error);
            }
        }));
        
        console.log(`All ${matchingTabs.length} tabs processed for blocking`);
    } catch (error) {
        console.error("Error in blockAllMatchingTabs:", error);
    }
}

// Handle open tabs after URL reset
export async function handleOpenTabsAfterReset(blockUrl, activeTabId, resetActiveTabStartTime) {
    try {
        const tabs = await chrome.tabs.query({});
        const blockPattern = createBlockRegex(blockUrl);

        // Find and handle tabs that match the block URL pattern
        for (const tab of tabs) {
            if (blockPattern.test(tab.url)) {
                // Reset the start time for active tab
                if (tab.id === activeTabId) {
                    resetActiveTabStartTime();
                    
                    // Only reload if the tab is currently showing the block page
                    // and hasn't been recently reloaded
                    if (!wasTabRecentlyReloaded(tab.id)) {
                        markTabAsReloaded(tab.id);
                        console.log("Will reload tab in 2 seconds - handleOpenTabsAfterReset");
                        setTimeout(() => {
                            chrome.tabs.reload(tab.id);
                            console.log("Reloading tab handleOpenTabsAfterReset");
                        }, 2000);
                    }
                }
            }
        }
    } catch (error) {
        console.error("Error handling open tabs after reset:", error);
    }
}

// Register navigation event listeners
export function registerNavigationListeners(fetchUrls) {
    // Handle completed navigation
    chrome.webNavigation.onCompleted.addListener(
        async (details) => {
            const urls = await fetchUrls();
            if (urls && Array.isArray(urls)) {
                await handleNavigation(details, urls);
            }
        },
        { url: [{ schemes: ["http", "https"] }] }
    );

    // Handle committed navigation to catch navigation as early as possible
    chrome.webNavigation.onCommitted.addListener(
        async (details) => {
            const urls = await fetchUrls();
            if (urls && Array.isArray(urls)) {
                await handleNavigation(details, urls);
            }
        },
        { url: [{ schemes: ["http", "https"] }] }
    );

    // Handle tab updates to catch dynamic URL changes
    chrome.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
        if (changeInfo.status === 'complete' && tab.url) {
            const urls = await fetchUrls();
            if (urls && Array.isArray(urls)) {
                await handleNavigation({ tabId, url: tab.url, frameId: 0 }, urls);
            }
        }
    });

    // Handle history state updates (for single-page apps)
    chrome.webNavigation.onHistoryStateUpdated.addListener(
        async (details) => {
            const urls = await fetchUrls();
            if (urls && Array.isArray(urls)) {
                await handleNavigation(details, urls);
            }
        }
    );
}