// Force reset module to manually reset URL states regardless of time or previous resets
import { resetAllUrls } from './stateManager';

// Function to force reset all URL tracking states
export async function forceResetAllUrls() {
    try {
        console.log("FORCE RESET: Manually resetting all URL states...");
        
        // First, remove the lastResetTime to bypass the daily reset check
        await new Promise(resolve => {
            chrome.storage.local.remove('lastResetTime', resolve);
        });
        
        // This will reset all URL states unconditionally
        const resetCount = await resetAllUrls();
        
        console.log(`FORCE RESET: Manual reset completed. Reset ${resetCount} URLs.`);
        
        // Reload all tabs to reflect the unblocked status
        chrome.tabs.query({}, (tabs) => {
            for (const tab of tabs) {
                if (tab && tab.id) {
                    chrome.tabs.reload(tab.id);
                }
            }
            console.log("Reloaded all tabs to apply unblock state");
        });
        
        return resetCount;
    } catch (error) {
        console.error("FORCE RESET: Error during force reset:", error);
        throw error;
    }
}

// Create a context menu item for manual reset
export function setupForceResetMenu() {
    // Remove any existing menu items to avoid duplicates
    chrome.contextMenus.removeAll(() => {
        // Create a new menu item
        chrome.contextMenus.create({
            id: "forceReset",
            title: "Reset All Website Timers",
            contexts: ["action"] // This shows the menu when right-clicking the extension icon
        });
        
        // Add event listener for when the menu item is clicked
        chrome.contextMenus.onClicked.addListener((info) => {
            if (info.menuItemId === "forceReset") {
                forceResetAllUrls()
                    .then(count => {
                        // Notification after successful reset
                        chrome.notifications.create({
                            type: 'basic',
                            iconUrl: '/icon-128.png',
                            title: 'Website Timers Reset',
                            message: `Successfully reset ${count} websites. All sites are now unblocked.`,
                            priority: 2
                        });
                    })
                    .catch(error => {
                        console.error("Error during force reset:", error);
                        // Notification on reset failure
                        chrome.notifications.create({
                            type: 'basic',
                            iconUrl: '/icon-128.png',
                            title: 'Reset Failed',
                            message: 'There was a problem resetting website timers.',
                            priority: 2
                        });
                    });
            }
        });
    });
}