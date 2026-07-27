import { getState, setState } from './storage';
import { createBlockRegex } from './urlUtils';

// RedirectManager class to handle redirects with cooldown periods
class RedirectManager {
    constructor() {
        this.REDIRECT_COOLDOWN = 120000; // 60 seconds cooldown between redirects
        this.STORAGE_KEY = 'redirectManagerData';
        this.REDIRECT_COUNTS_KEY = 'redirectManagerCounts';
        // Flag to indicate a redirect is currently in progress
        this.redirectInProgress = false;
        // Lock to ensure only one redirect happens for a given URL
        this.locks = new Map();
        // Flag to track if we've already redirected for this time limit cycle
        this.redirectedUrls = new Set();
        // Flag to track if URL notification states should be reset after being deleted and re-added
        this.resetNotificationStates = new Map();
    }

    // Check if a URL pattern has been recently redirected
    async hasRecentRedirect(blockUrl) {
        // First check if we've already redirected this URL in this cycle
        if (this.redirectedUrls.has(blockUrl)) {
            console.log("URL already redirected in this cycle:", blockUrl);
            return true;
        }

        // Check if there's a lock on this URL
        if (this.locks.has(blockUrl)) {
            console.log("Lock exists for URL:", blockUrl);
            return true;
        }

        // Then check the in-memory flag for redirect in progress
        if (this.redirectInProgress) {
            console.log("Redirect in progress detected for:", blockUrl);
            return true;
        }

        const now = Date.now();
        const data = await getState(this.STORAGE_KEY, {});
        
        // Ensure blockUrl is a string and normalize it to avoid undefined keys
        const sanitizedUrl = blockUrl ? blockUrl.toString().trim() : "";
        if (!sanitizedUrl) {
            console.error("Invalid blockUrl provided:", blockUrl);
            return false;
        }
        
        // Check for standard YouTube URL format
        if (sanitizedUrl.includes('youtube.com') || sanitizedUrl.includes('youtu.be')) {
            // For YouTube, we'll check both with and without www prefix
            const ytKeys = [
                `redirect_${sanitizedUrl}`,
                `redirect_https://www.youtube.com`,
                `redirect_https://youtube.com`
            ];
            
            // Log all potential keys we're checking
            console.log("Checking YouTube redirect keys:", ytKeys);
            
            // Check each potential key
            for (const key of ytKeys) {
                if (data[key] && (now - parseInt(data[key]) < this.REDIRECT_COOLDOWN)) {
                    console.log(`Found recent YouTube redirect under key: ${key}`);
                    return true;
                }
            }
            
            console.log("No recent YouTube redirects found");
            return false;
        }
        
        // Normal key check for non-YouTube URLs
        const key = `redirect_${sanitizedUrl}`;
        console.log("Checking recent redirect for:", sanitizedUrl, key, data[key]);
        
        // Add additional logging to help debug
        if (data[key] === undefined) {
            console.log("No recent redirect found for this URL");
            return false;
        }
        
        return now - parseInt(data[key]) < this.REDIRECT_COOLDOWN;
    }

    // Acquire a lock for a URL - returns true if lock acquired, false if already locked
    acquireLock(blockUrl) {
        // Ensure blockUrl is a string and normalize it
        const sanitizedUrl = blockUrl ? blockUrl.toString().trim() : "";
        if (!sanitizedUrl) {
            console.error("Invalid blockUrl provided for lock:", blockUrl);
            return false;
        }
        
        // Check if we already have this lock (important for preventing recursive lock attempts)
        if (this.locks.has(sanitizedUrl)) {
            const lockTime = this.locks.get(sanitizedUrl);
            // If lock is very recent (within last 500ms), it's probably our own lock
            // This prevents race conditions where the same code path tries to acquire the same lock twice
            if (Date.now() - lockTime < 500) {
                console.log("Already holding a recent lock for URL:", sanitizedUrl);
                return true; // Return true to allow operation to continue
            }
            
            console.log("Failed to acquire lock for URL - already locked by another process:", sanitizedUrl);
            return false;
        }
        
        this.locks.set(sanitizedUrl, Date.now());
        console.log("Lock acquired for URL:", sanitizedUrl);
        return true;
    }

    // Release a lock for a URL
    releaseLock(blockUrl) {
        // Ensure blockUrl is a string and normalize it
        const sanitizedUrl = blockUrl ? blockUrl.toString().trim() : "";
        if (!sanitizedUrl) {
            console.error("Invalid blockUrl provided for lock release:", blockUrl);
            return;
        }
        
        if (this.locks.has(sanitizedUrl)) {
            this.locks.delete(sanitizedUrl);
            console.log("Lock released for URL:", sanitizedUrl);
        } else {
            console.log("No lock found to release for URL:", sanitizedUrl);
        }
    }

    // Mark a URL as redirected in this cycle
    markUrlRedirected(blockUrl) {
        // Ensure blockUrl is a string and normalize it
        const sanitizedUrl = blockUrl ? blockUrl.toString().trim() : "";
        if (!sanitizedUrl) {
            console.error("Invalid blockUrl provided for marking redirected:", blockUrl);
            return;
        }
        
        this.redirectedUrls.add(sanitizedUrl);
        console.log("Marked URL as redirected in this cycle:", sanitizedUrl);
        
        // Clean up after a delay
        setTimeout(() => {
            this.redirectedUrls.delete(sanitizedUrl);
            console.log("Cleared redirected URL from cycle:", sanitizedUrl);
        }, 5000); // Clear after 5 seconds
    }

    // Set the in-progress flag (synchronous, immediate effect)
    setRedirectInProgress(inProgress) {
        this.redirectInProgress = inProgress;
        console.log("Set redirect in progress:", inProgress);
    }

    // Record a redirect
    async recordRedirect(blockUrl) {
        // Set in-memory flag first for immediate effect
        this.setRedirectInProgress(true);
        
        // Ensure blockUrl is a string and normalize it
        const sanitizedUrl = blockUrl ? blockUrl.toString().trim() : "";
        if (!sanitizedUrl) {
            console.error("Invalid blockUrl provided for redirect:", blockUrl);
            this.setRedirectInProgress(false);
            return;
        }
        
        // Mark this URL as redirected in this cycle
        this.markUrlRedirected(sanitizedUrl);

        // Update storage
        const data = await getState(this.STORAGE_KEY, {});
        const key = `redirect_${sanitizedUrl}`;
        data[key] = Date.now();
        console.log("Recording redirect for:", sanitizedUrl, key, data[key]);
        await setState(this.STORAGE_KEY, data);

        // Increment redirect count
        await this.incrementRedirectCount(sanitizedUrl);

        // Set expiration through setTimeout
        setTimeout(async () => {
            const currentData = await getState(this.STORAGE_KEY, {});
            delete currentData[key];
            await setState(this.STORAGE_KEY, currentData);
            console.log("Cleared redirect for:", sanitizedUrl, key);
            
            // Reset the in-progress flag
            this.setRedirectInProgress(false);
            
            // Release the lock
            this.releaseLock(sanitizedUrl);
        }, this.REDIRECT_COOLDOWN);
    }

    // Get the number of redirects for a URL
    async getRedirectCount(blockUrl) {
        // Ensure blockUrl is a string and normalize it
        const sanitizedUrl = blockUrl ? blockUrl.toString().trim() : "";
        if (!sanitizedUrl) {
            console.error("Invalid blockUrl provided for getRedirectCount:", blockUrl);
            return 0;
        }
        
        const counts = await getState(this.REDIRECT_COUNTS_KEY, {});
        return counts[sanitizedUrl] || 0;
    }

    // Increment the redirect count for a URL
    async incrementRedirectCount(blockUrl) {
        // Ensure blockUrl is a string and normalize it
        const sanitizedUrl = blockUrl ? blockUrl.toString().trim() : "";
        if (!sanitizedUrl) {
            console.error("Invalid blockUrl provided for incrementRedirectCount:", blockUrl);
            return 0;
        }
        
        const counts = await getState(this.REDIRECT_COUNTS_KEY, {});
        counts[sanitizedUrl] = (counts[sanitizedUrl] || 0) + 1;
        await setState(this.REDIRECT_COUNTS_KEY, counts);
        console.log(`Redirect count for ${sanitizedUrl} increased to ${counts[sanitizedUrl]}`);
        return counts[sanitizedUrl];
    }

    // Reset redirect count for a URL
    async resetRedirectCount(blockUrl) {
        // Ensure blockUrl is a string and normalize it
        const sanitizedUrl = blockUrl ? blockUrl.toString().trim() : "";
        if (!sanitizedUrl) {
            console.error("Invalid blockUrl provided for resetRedirectCount:", blockUrl);
            return;
        }
        
        const counts = await getState(this.REDIRECT_COUNTS_KEY, {});
        counts[sanitizedUrl] = 0;
        await setState(this.REDIRECT_COUNTS_KEY, counts);
        console.log(`Redirect count for ${sanitizedUrl} reset to 0`);
    }

    // Get all redirect counts
    async getAllRedirectCounts() {
        return await getState(this.REDIRECT_COUNTS_KEY, {});
    }

    // Clean up all redirects
    async cleanup() {
        await setState(this.STORAGE_KEY, {});
        this.redirectInProgress = false;
        this.locks.clear();
        this.redirectedUrls.clear();
    }

    // Track redirected URLs in memory instead of sessionStorage
    isUrlRedirected(blockUrl) {
        const patternKey = createBlockRegex(blockUrl).toString();
        // Check our redirectedUrls set instead of sessionStorage
        return this.redirectedUrls.has(blockUrl) || this.redirectedUrls.has(patternKey);
    }

    // Set URL as redirected in memory instead of sessionStorage
    setUrlRedirected(blockUrl, value = true) {
        const patternKey = createBlockRegex(blockUrl).toString();
        if (value) {
            // Add to our redirectedUrls set instead of sessionStorage
            this.redirectedUrls.add(blockUrl);
            this.redirectedUrls.add(patternKey);
            console.log(`URL ${blockUrl} marked as redirected in memory`);
        } else {
            // Remove from our redirectedUrls set
            this.redirectedUrls.delete(blockUrl);
            this.redirectedUrls.delete(patternKey);
            console.log(`URL ${blockUrl} unmarked as redirected in memory`);
        }
    }

    // Mark a URL for notification state reset after deletion and re-addition
    markForNotificationReset(blockUrl) {
        // Ensure blockUrl is a string and normalize it
        const sanitizedUrl = blockUrl ? blockUrl.toString().trim() : "";
        if (!sanitizedUrl) {
            console.error("Invalid blockUrl provided for marking notification reset:", blockUrl);
            return;
        }
        
        this.resetNotificationStates.set(sanitizedUrl, Date.now());
        console.log("URL marked for notification reset after re-addition:", sanitizedUrl);
        
        // Auto-cleanup after 5 minutes to prevent memory leaks
        setTimeout(() => {
            if (this.resetNotificationStates.has(sanitizedUrl)) {
                this.resetNotificationStates.delete(sanitizedUrl);
                console.log("Auto-cleaned notification reset flag for:", sanitizedUrl);
            }
        }, 5 * 60 * 1000); // 5 minutes
    }

    // Check if a URL was recently deleted and needs notification states reset
    shouldResetNotificationStates(blockUrl) {
        // Ensure blockUrl is a string and normalize it
        const sanitizedUrl = blockUrl ? blockUrl.toString().trim() : "";
        if (!sanitizedUrl) {
            return false;
        }
        
        // Check if URL is marked for reset
        if (this.resetNotificationStates.has(sanitizedUrl)) {
            const markedTime = this.resetNotificationStates.get(sanitizedUrl);
            const timeSinceMarked = Date.now() - markedTime;
            
            // Only reset if marked within the last 5 minutes
            if (timeSinceMarked < 5 * 60 * 1000) {
                // URL was recently deleted, return true but DON'T clear the flag here
                // The flag will be cleared by the caller after processing
                console.log("URL should have notification states reset:", sanitizedUrl);
                return true;
            } else {
                // Too old, clean up the flag
                this.resetNotificationStates.delete(sanitizedUrl);
                console.log("Notification reset flag expired for:", sanitizedUrl);
            }
        }
        
        return false;
    }
    
    // Method to manually clear the reset flag (called after processing)
    clearResetFlag(blockUrl) {
        const sanitizedUrl = blockUrl ? blockUrl.toString().trim() : "";
        if (sanitizedUrl && this.resetNotificationStates.has(sanitizedUrl)) {
            this.resetNotificationStates.delete(sanitizedUrl);
            console.log("Reset flag cleared for:", sanitizedUrl);
        }
    }
}

// Create singleton instance
const redirectManager = new RedirectManager();
export default redirectManager;