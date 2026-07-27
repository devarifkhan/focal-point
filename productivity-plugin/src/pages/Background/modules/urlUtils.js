// Helper function for URL normalization
export function normalizeUrl(url) {
    try {
        // Handle empty or undefined URLs
        if (!url) {
            console.warn("Empty URL passed to normalizeUrl");
            return "";
        }
        
        // Ensure URL is a string
        let normalizedUrl = String(url).trim();
        
        // Add protocol if missing
        if (!normalizedUrl.startsWith('http://') && !normalizedUrl.startsWith('https://')) {
            normalizedUrl = 'https://' + normalizedUrl;
        }
        
        try {
            // Try to properly normalize using URL object
            const urlObj = new URL(normalizedUrl);
            // Get hostname and path (lowercase for consistency)
            let host = urlObj.hostname.toLowerCase();
            const path = urlObj.pathname;
            
            // Determine if we need to add www. prefix for consistency
            if (host.includes('youtube.com') && !host.startsWith('www.')) {
                host = 'www.' + host;
            }
            
            // Rebuild the normalized URL
            normalizedUrl = urlObj.protocol + '//' + host + path;
            
            // Remove trailing slash if present
            if (normalizedUrl.endsWith('/')) {
                normalizedUrl = normalizedUrl.slice(0, -1);
            }
            
            console.log(`Normalized URL: "${url}" → "${normalizedUrl}"`);
            return normalizedUrl;
        } catch (parseError) {
            console.warn("URL parsing failed, using simple normalization:", parseError);
            // Remove trailing slash if present
            if (normalizedUrl.endsWith('/')) {
                normalizedUrl = normalizedUrl.slice(0, -1);
            }
            return normalizedUrl;
        }
    } catch (error) {
        console.error("Error normalizing URL:", error);
        return String(url || "");
    }
}

// Helper function to extract domain from URL
export function getDomain(url) {
    try {
        const urlObj = new URL(url);
        let domain = urlObj.hostname.toLowerCase();
        if (domain.startsWith("www.")) {
            domain = domain.slice(4);
        }
        return domain;
    } catch (e) {
        console.error("Error extracting domain from URL:", e);
        return "";
    }
}

// Helper function to extract Amazon product ID
export function extractAmazonProductId(url) {
    try {
        const urlObj = new URL(url);
        
        // Try to extract from /dp/ path
        const dpMatch = url.match(/\/dp\/([A-Z0-9]{10})/);
        if (dpMatch) return dpMatch[1];
        
        // Try to extract from /gp/product/ path
        const gpMatch = url.match(/\/gp\/product\/([A-Z0-9]{10})/);
        if (gpMatch) return gpMatch[1];
        
        return null;
    } catch (error) {
        console.error("Error extracting Amazon product ID:", error);
        return null;
    }
}

// Create regex for blocking URLs
export function createBlockRegex(blockUrl) {
    // Extract domain and path information
    let urlObj;
    try {
        urlObj = new URL(blockUrl.trim());  // Trim whitespace from blockUrl
    } catch {
        urlObj = new URL('https://' + blockUrl.trim());
    }

    const domain = urlObj.hostname.replace('www.', '');
    const path = urlObj.pathname.replace(/\/$/, ''); // Remove trailing slash
    const videoId = new URLSearchParams(urlObj.search).get('v');

    // Escape special characters in domain
    const escapedDomain = domain.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

    // Case 1: Specific video URL
    if (videoId) {
        return new RegExp(`^(?:https?:\/\/)?(?:www\.)?${escapedDomain}\/watch\\?v=${videoId}(?:&.*)?$`);
    }

    // Case 2: Specific shorts URL with ID
    if (path.includes('/shorts/')) {
        return new RegExp(`^(?:https?:\/\/)?(?:www\.)?${escapedDomain}\/shorts\/[^\/]+$`);
    }

    // Case 3: Watch path with or without query
    if (path === '/watch') {
        return new RegExp(`^(?:https?:\/\/)?(?:www\.)?${escapedDomain}\/watch\/?(?:\\?.*)?$`);
    }

    // Case 4: Specific path (like /shorts, /feed, etc)
    if (path && path !== '/') {
        return new RegExp(`^(?:https?:\/\/)?(?:www\.)?${escapedDomain}${path}(?:\/.*)?$`);
    }

    // Case 5: Root domain - block everything under the domain
    if (path === '/' || path === '') {
        return new RegExp(`^(?:https?:\/\/)?(?:www\.)?${escapedDomain}(?:\/.*)?$`);
    }

    return new RegExp(`^(?:https?:\/\/)?(?:www\.)?${escapedDomain}${path}$`);
}

// Helper function to check if URL is an extension page
function isExtensionUrl(url) {
    return url && (url.startsWith('chrome-extension://') || url.startsWith('moz-extension://') || url.startsWith('extension://'));
}

// Compare URLs to determine if they match block criteria
export function compareUrls(blockUrl, tabUrl) {
    try {
        // Never block extension pages (options, popup, etc.)
        if (isExtensionUrl(tabUrl)) {
            console.log("Extension URL detected, skipping block:", tabUrl);
            return false;
        }
        
        // Normalize both URLs before comparison
        const normalizedBlockUrl = normalizeUrl(blockUrl);
        const normalizedTabUrl = normalizeUrl(tabUrl);
        
        // Check for exact match first after normalization
        if (normalizedBlockUrl === normalizedTabUrl) {
            console.log("Exact URL match found");
            return true;
        }

        // Extract domains
        const blockDomain = getDomain(blockUrl);
        const tabDomain = getDomain(tabUrl);

        // If domains don't match, return false early
        if (blockDomain !== tabDomain) {
            console.log("Domain mismatch");
            return false;
        }

        // Special handling for Amazon URLs
        if (blockDomain.includes('amazon')) {
            // Extract product IDs
            const blockProductId = extractAmazonProductId(blockUrl);
            const tabProductId = extractAmazonProductId(tabUrl);
            
            // If both URLs have product IDs, compare them
            if (blockProductId && tabProductId) {
                console.log("Comparing Amazon product IDs:", blockProductId, tabProductId);
                return blockProductId === tabProductId;
            }
            
            // If block URL is just amazon.com, block all Amazon URLs
            if (blockUrl.match(/^https?:\/\/(www\.)?amazon\.[a-z.]+\/?$/)) {
                console.log("Blocking all Amazon URLs");
                return true;
            }
        }
        
        // If no special cases match, use regex pattern
        const regex = createBlockRegex(blockUrl);
        const result = regex.test(tabUrl);
        console.log("Using regex pattern match:", result);
        return result;
    } catch (error) {
        console.error("Error in compareUrls:", error);
        return false;
    }
}

// Get tracking URL for a given tab URL
export async function getTrackingUrl(currentUrl, fetchUrlsFn) {
    try {
        // Get the URLs list from storage/state
        const urls = await fetchUrlsFn();
        if (!urls || !Array.isArray(urls)) return normalizeUrl(currentUrl);

        // Find matching block URL based on compareUrls logic
        const matchingElement = urls.find((element) => {
            console.log("Comparing URLs:", element.block_urls, currentUrl, compareUrls(element.block_urls, currentUrl));
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
        return normalizeUrl(currentUrl);
    }
}

// Pattern validation function
export function validatePattern(pattern, url) {
    try {
        const regex = new RegExp(pattern);
        console.log("Validating pattern:", pattern, url, regex.test(url));
        return regex.test(url);
    } catch (err) {
        console.error("Invalid regex pattern:", err);
        return false;
    }
}