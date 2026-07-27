import { sessionData } from "../config/sessionKeys";

// Handle logout and redirect to login
export const handleTokenExpiration = async () => {
    // Clear all authentication data
    localStorage.removeItem('access_token');
    localStorage.removeItem(sessionData);
    
    // Handle time tracking logout
    try {
        const { handleLogout } = await import('../pages/Background/modules/logoutHandler');
        await handleLogout();
    } catch (error) {
        console.error('Error handling time tracking logout:', error);
    }
    
    // Clear from chrome storage
    chrome.storage.local.remove('access_token', () => {
        // Dispatch storage event to update UI
        window.dispatchEvent(new Event('storage'));
        
        // Force reload to show login page
        window.location.reload();
    });
};

// Check if error indicates token expiration
export const isTokenExpiredError = (error) => {
    // Check API response for TOKEN_EXPIRED code
    if (error?.data?.code === "TOKEN_EXPIRED" || 
        error?.response?.data?.code === "TOKEN_EXPIRED" ||
        error?.data?.code === "token_not_valid" || 
        error?.response?.data?.code === "token_not_valid") {
        return true;
    }
    
    // Check WebSocket error for token expiration message
    if (typeof error === 'string' && error === "Invalid or expired token") {
        return true;
    }
    
    // Check if error object has the message
    if (error?.error === "Invalid or expired token" || 
        error?.message === "Invalid or expired token") {
        return true;
    }
    
    return false;
};