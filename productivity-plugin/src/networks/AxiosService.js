import axios from 'axios';
import {sessionData} from "../config/sessionKeys";
import {API_BASE_URL, DEFAULT_LANGUAGE} from "../config/config";
import { handleTokenExpiration, isTokenExpiredError } from "../utils/authUtils";

function getRequestHeaders(isMultipart = false) {
    // let userData = JSON.parse(localStorage.getItem(sessionData));
    const token = localStorage.getItem('access_token');
    let idToken = token //userData?.idToken ?? '';
    const content_type = isMultipart ? 'multipart/form-data' : 'application/json';

    // Debug log
    console.log("Auth token available:", !!idToken);
    if (idToken) {
        console.log("Token first 10 chars:", idToken.substring(0, 10) + "...");
    }

    const headers = {
        'Accept-Language': DEFAULT_LANGUAGE,
    };
    
    // Only add Content-Type for non-FormData requests
    // DO NOT set Content-Type for multipart/form-data - browser will set it with boundary
    if (!isMultipart) {
        headers['Content-Type'] = content_type;
    }
    
    // Add Authorization header if token exists
    if (idToken) {
        headers['Authorization'] = `Bearer ${idToken}`;
    }
    
    console.log("Request headers:", headers);
    
    return headers;
}

const BASE_URL = API_BASE_URL;

async function get(url, parameter) {
    try {
        return await axios.get(BASE_URL + url, {
            params: parameter,
            headers: getRequestHeaders()
        });
    } catch (error) {
        console.error(`GET request failed for ${url}:`, error);
        throw formatAxiosError(error);
    }
}

async function post(url, body, isMultipart = false) {
    try {
        console.log(`Sending POST request to ${BASE_URL + url}`);
        console.log(`Request is ${isMultipart ? 'multipart/form-data' : 'JSON'}`);
        
        // Special handling for FormData
        if (isMultipart && body instanceof FormData) {
            console.log("FormData detected, using appropriate headers");
            
            // When using FormData, let the browser set the Content-Type with boundary
            const headers = getRequestHeaders(true);
            
            return await axios.post(BASE_URL + url, body, { 
                headers: headers 
            });
        } else {
            // Normal JSON data
            return await axios.post(BASE_URL + url, body, {
                headers: getRequestHeaders(isMultipart)
            });
        }
    } catch (error) {
        console.error(`POST request failed for ${url}:`, error);
        if (error.response) {
            console.error("Response status:", error.response.status);
            console.error("Response headers:", error.response.headers);
            console.error("Response data:", error.response.data);
        }
        throw formatAxiosError(error);
    }
}

async function put(url, body, isMultipart = false) {
    try {
        console.log(`Sending PUT request to ${BASE_URL + url}`);
        console.log(`Request is ${isMultipart ? 'multipart/form-data' : 'JSON'}`);
        
        // Special handling for FormData
        if (isMultipart && body instanceof FormData) {
            console.log("FormData detected, using appropriate headers");
            
            // When using FormData, let the browser set the Content-Type with boundary
            const headers = getRequestHeaders(true);
            
            return await axios.put(BASE_URL + url, body, { 
                headers: headers 
            });
        } else {
            // Normal JSON data
            return await axios.put(BASE_URL + url, body, {
                headers: getRequestHeaders(isMultipart)
            });
        }
    } catch (error) {
        console.error(`PUT request failed for ${url}:`, error);
        if (error.response) {
            console.error("Response status:", error.response.status);
            console.error("Response headers:", error.response.headers);
            console.error("Response data:", error.response.data);
        }
        throw formatAxiosError(error);
    }
}

async function patch(url, body) {
    try {
        return await axios.patch(BASE_URL + url, body, {
            headers: getRequestHeaders()
        });
    } catch (error) {
        console.error(`PATCH request failed for ${url}:`, error);
        throw formatAxiosError(error);
    }
}

async function remove(url, body) {
    try {
        return await axios.delete(BASE_URL + url, {
            data: body,
            headers: getRequestHeaders()
        });
    } catch (error) {
        console.error(`DELETE request failed for ${url}:`, error);
        throw formatAxiosError(error);
    }
}

// Helper function to format axios errors into a more usable format
function formatAxiosError(error) {
    let formattedError = {
        toString: function() {
            return this.message;
        }
    };
    
    console.log("Formatting axios error:", error);
    
    if (error.response) {
        // The request was made and the server responded with a status code
        // that falls out of the range of 2xx
        const responseData = error.response.data;
        let message = '';
        let errorCode = '';
        
        console.log("Response data:", responseData);
        
        // Extract error code from various response formats
        if (responseData?.code) {
            errorCode = responseData.code;
        }
        
        // Try to extract message from various response data formats
        if (typeof responseData === 'string') {
            message = responseData;
        } else if (responseData?.message) {
            message = responseData.message;
        } else if (responseData?.error) {
            message = typeof responseData.error === 'string' ? responseData.error : JSON.stringify(responseData.error);
        } else {
            message = `Error: ${error.response.status} ${error.response.statusText}`;
        }
        
        formattedError = {
            ...formattedError,
            message: message,
            status: error.response.status,
            data: responseData,
            response: error.response,  // Preserve original response
            code: errorCode,  // Extract code for easier access
            error: responseData?.error,  // Extract error for easier access
            isAxiosError: true
        };
        
        console.log("Formatted error:", formattedError);
        
        // Check for token expiration and handle logout
        if (isTokenExpiredError(formattedError)) {
            console.log("Token expired, logging out user");
            handleTokenExpiration();
        }
    } else if (error.request) {
        // The request was made but no response was received
        formattedError = {
            ...formattedError,
            message: 'Network error: No response received from server',
            isAxiosError: true,
            isNetworkError: true
        };
    } else {
        // Something happened in setting up the request that triggered an Error
        formattedError = {
            ...formattedError,
            message: error.message || 'Unknown error occurred',
            isAxiosError: true
        };
    }
    
    return formattedError;
}

const AxiosServices = {
    get,
    post,
    put,
    patch,
    remove
};

export default AxiosServices;
