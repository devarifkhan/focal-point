// Handle logout and maintain time tracking state
export async function handleLogout() {
    try {
        console.log('Handling logout - maintaining time tracking state');
        
        // Sync current server state to local storage before logout
        try {
            const { getAccessToken } = await import('./storage');
            const token = await getAccessToken();
            
            if (token) {
                const AxiosServices = (await import('../../../networks/AxiosService')).default;
                const ApiUrlServices = (await import('../../../networks/ApiUrlServices')).default;
                
                // Get the latest server state for all URLs
                const response = await AxiosServices.get(ApiUrlServices.GET_URL_LIST);
                const serverUrls = response.data.data.urls || [];
                
                // First get existing blocked_urls from local storage
                chrome.storage.local.get('blocked_urls', (result) => {
                    const existingUrls = result.blocked_urls || [];
                    
                    // Create a map of existing URLs for quick lookup
                    const existingUrlMap = {};
                    existingUrls.forEach(url => {
                        existingUrlMap[url.block_urls] = url;
                    });
                    
                    // For each server URL, preserve the visited/blocked status
                    const preservedUrls = serverUrls.map(serverUrl => {
                        const existingUrl = existingUrlMap[serverUrl.block_urls];
                        
                        // Always preserve the blocked state (true) for sites that should stay blocked after logout
                        // This ensures sites remain blocked regardless of the eye icon being clicked
                        const preservedUrl = {
                            ...serverUrl,
                            source: 'local', // Mark as local after logout
                            // If the site is currently blocked ("true") OR server says it should be blocked, keep it blocked
                            visited: (existingUrl && existingUrl.visited === "true") ? "true" : serverUrl.visited,
                            // Also preserve other critical tracking data
                            used_time: existingUrl ? (existingUrl.used_time || existingUrl.time || serverUrl.used_time || "0.00") : (serverUrl.used_time || "0.00"),
                            half_time_notified: existingUrl ? (existingUrl.half_time_notified || "false") : (serverUrl.half_time_notified || "false"),
                            one_quarter_notified: existingUrl ? (existingUrl.one_quarter_notified || "false") : (serverUrl.one_quarter_notified || "false"),
                            three_quarter_notified: existingUrl ? (existingUrl.three_quarter_notified || "false") : (serverUrl.three_quarter_notified || "false")
                        };
                                                
                        console.log(`URL ${serverUrl.block_urls} - Server visited: ${serverUrl.visited}, Final: ${preservedUrl.visited}`);
                        
                        return preservedUrl;
                    });
                    
                    // Also include purely local URLs that don't exist on the server
                    const localOnlyUrls = existingUrls.filter(url => 
                        !serverUrls.some(serverUrl => serverUrl.block_urls === url.block_urls)
                    ).map(url => ({
                        ...url,
                        source: 'local' // Ensure local-only URLs are marked as local
                    }));
                    
                    console.log(`Found ${localOnlyUrls.length} local-only URLs to preserve`);
                    
                    // Combine server URLs (with preserved state) and local-only URLs
                    const finalUrls = [...preservedUrls, ...localOnlyUrls];
                    
                    // Update local storage with preserved state
                    chrome.storage.local.set({ 'blocked_urls': finalUrls }, () => {
                        console.log('Synced server state to local storage during logout with preserved block status');
                    });
                });
            }
        } catch (syncError) {
            console.warn('Failed to sync server state during logout:', syncError);
        }
        
        // Clear WebSocket connections and cache
        try {
            const webSocketApiService = (await import('../../../services/WebSocketApiService.js')).default;
            webSocketApiService.disconnect();
        } catch (wsError) {
            console.warn('WebSocket disconnect failed during logout:', wsError);
        }
        
        // Force time tracker to reinitialize with local storage data
        const { getTimeTrackerController } = await import('./timeTracker');
        const controller = getTimeTrackerController();
        if (controller) {
            controller.resetCheckTime();
        }
        
    } catch (error) {
        console.error('Error handling logout:', error);
    }
}