export function formatUrl(url) {
    try {
        // Reject extension URLs
        if (url && (url.startsWith('chrome-extension://') || 
                   url.startsWith('moz-extension://') || 
                   url.startsWith('extension://'))) {
            return null;
        }
        
        if (!url.includes("://")) {
            url = `https://${url}`;
        }

        const urlObj = new URL(url);

        if (urlObj.protocol === "http:") {
            if (!urlObj.hostname.startsWith("www.")) {
                urlObj.hostname = `www.${urlObj.hostname}`;
            }
            return urlObj.href;
        }

        if (urlObj.protocol === "https:") {
            if (!urlObj.hostname.startsWith("www.")) {
                urlObj.hostname = `www.${urlObj.hostname}`;
            }
            return urlObj.href;
        }

        if (!urlObj.hostname.startsWith("www.")) {
            urlObj.hostname = `www.${urlObj.hostname}`;
        }

        return urlObj.href;
    } catch (error) {
        return null;
    }
}