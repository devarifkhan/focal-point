import { useFormik } from "formik";
import React, { useEffect, useState } from "react";
import CustomModal from "../../components/common/CustomModal/CustomModal";
import Header from "../../components/Header/Header";
import InputField from "../../components/InputField/InputField";
import { IMAGE_BASE_URL } from "../../config/config";
import ApiUrlServices from "../../networks/ApiUrlServices";
import AxiosServices from "../../networks/AxiosService";
import BlockedWebsitesList from "./BlockItemCard/BlockItemCard";
import { formatUrl } from "../../components/formatUrl";
import { LogIn, AlertTriangle, Cloud, Database, Trash2 } from "lucide-react";
import CustomButton from "../../components/common/CustomButton/CustomButton";
import Login from "../../components/Login/Login";
import MessageContainer from "../../components/MessageContainer/MessageContainer";
import webSocketApiService from '../../services/WebSocketApiService.js';
import '../../utils/webSocketTester.js'; // For development testing
import { compareUrls } from '../Background/modules/urlUtils';

const generateUniqueId = () => {
    return 'id_' + Math.random().toString(36).substr(2, 9) + '_' + Date.now();
};

const Options = () => {
    const [isLoading, setIsLoading] = useState(false);
    const [isBlockModalOpen, setIsBlockModalOpen] = useState(false);
    const [isAddModalOpen, setIsAddModalOpen] = useState(false);
    const [message, setMessage] = React.useState({ type: "", message: "" });
    const [modalMessage, setModalMessage] = React.useState({ type: "", message: "" }); // Add this for modal-specific messages
    const [allBlockUrls, setAllBlockUrls] = React.useState([]);
    const [editingUrl, setEditingUrl] = useState(null);
    const [token, setToken] = useState(localStorage.getItem("access_token"));
    const [deleteId, setDeleteId] = useState(null);
    const [isEmpty, setIsEmpty] = useState(false);
    const [showLogin, setShowLogin] = useState(false);
    const [showDefaultTime, setShowDefaultTime] = useState(false);

    // Create refs for file inputs to be able to clear them
    const editFileInputRef = React.useRef(null);
    const addFileInputRef = React.useRef(null);

    // Initialize WebSocket when add modal opens
    useEffect(() => {
        if (isAddModalOpen && token && !webSocketApiService.isConnected()) {
            webSocketApiService.initialize().catch(error => {
                console.error('Failed to initialize WebSocket for add modal:', error);
            });
        }
    }, [isAddModalOpen, token]);

    // Add URL form
    const addForm = useFormik({
        initialValues: {
            activeTabLink: "",
            redirectUrl: "",
            minutesToUnblock: "",
            default_time: "",
            message: "",
            calender_url: "",
            is_temporary: "true",
            image: "",
        },
        validate: (values) => {
            const errors = {};

            if (!values.activeTabLink?.trim()) {
                errors.activeTabLink = "Website URL is required";
            } else if (values.activeTabLink.startsWith('chrome-extension://') ||
                       values.activeTabLink.startsWith('moz-extension://') ||
                       values.activeTabLink.startsWith('extension://')) {
                errors.activeTabLink = "Extension pages cannot be blocked";
            }

            const timeValue = values.minutesToUnblock;
            if (timeValue === "" || timeValue === null || timeValue === undefined) {
                errors.minutesToUnblock = "Time limit is required";
            } else if (isNaN(timeValue) || parseFloat(timeValue) < 0 || !Number.isInteger(parseFloat(timeValue))) {
                errors.minutesToUnblock = "Please enter a positive number (0, 1, 2, 3...)";
            }

            return errors;
        },
        onSubmit: async (values) => {
            setIsLoading(true);

            try {
                const userTimezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
                const formData = new FormData();

                // Format the activeTabLink URL
                const formattedUrl = formatUrl(values.activeTabLink.trim());
                if (!formattedUrl) {
                    throw new Error("Invalid Website URL");
                }

                // Format the redirectUrl if provided
                const formattedRedirectUrl = values.redirectUrl.trim() ? formatUrl(values.redirectUrl.trim()) : "";
                if (values.redirectUrl.trim() && !formattedRedirectUrl) {
                    throw new Error("Invalid Redirect URL");
                }

                formData.append("block_urls", formattedUrl);
                formData.append("redirect_urls", formattedRedirectUrl);
                formData.append("message", values.message?.trim() || "");
                formData.append("calender_url", values.calender_url?.trim() || "");
                formData.append("is_temporary", String(values.is_temporary).trim());
                formData.append("timezone", userTimezone);
                const isInstantBlock = values.minutesToUnblock == 0;
                formData.append("visited", isInstantBlock ? "true" : "false");
                formData.append("used_time", "0");
                formData.append("half_time_notified", "false");
                formData.append("one_quarter_notified", "false");
                formData.append("three_quarter_notified", "false");

                // Set today_limit and other time fields
                formData.append("today_limit", isInstantBlock ? "0" : String(values.minutesToUnblock || "0"));
                
                // Handle temporary vs default time synchronization
                if (values.is_temporary === "true") {
                    // When temporary is selected, only update temporary_time, keep default_time unchanged
                    formData.append("temporary_time", String(values.minutesToUnblock || "0"));
                    formData.append("default_time", String(values.default_time || "0"));
                } else {
                    // When default is selected, set both temporary_time and default_time to the same value
                    formData.append("temporary_time", String(values.minutesToUnblock || "0"));
                    formData.append("default_time", String(values.minutesToUnblock || "0"));
                }
                formData.append("time", "0");

                // Handle image upload for authenticated users
                let isMultipart = false;
                if (token && values.image && values.image instanceof File) {
                    formData.append("image", values.image);
                    formData.append("imageUpdate", "true");
                    isMultipart = true;

                    // Debug logs to verify FormData contents
                    console.log("FormData entries for debugging:");
                    for (let pair of formData.entries()) {
                        console.log(pair[0] + ': ' + (pair[0] === 'image' ? 'File object' : pair[1]));
                    }
                }

                if (token) {
                    // Authenticated user - use API with WebSocket integration
                    const response = await AxiosServices.post(ApiUrlServices.ADD_URL, formData, isMultipart);
                    if (response.data.code === "SUCCESS") {
                        // Show success message in the modal
                        setModalMessage({ message: "Website blocked successfully", type: "success" });

                        // Reset notification states for this URL to ensure clean state
                        chrome.runtime.sendMessage({
                            type: 'RESET_NOTIFICATION_STATES',
                            blockUrl: formattedUrl
                        }).catch(err => console.warn("Error resetting notification states:", err));
                        
                        // Mark this URL for notification reset in case it was recently deleted
                        const { default: redirectManager } = await import('../../pages/Background/modules/redirectManager');
                        redirectManager.markForNotificationReset(formattedUrl);

                        // Initialize WebSocket service if not already done
                        if (!webSocketApiService.isConnected()) {
                            await webSocketApiService.initialize();
                        }

                        // Refresh WebSocket data to get the latest URL list
                        await webSocketApiService.fetchUrls();

                        // Update local state immediately with new URL
                        const newUrl = {
                            id: response.data.data?.id || generateUniqueId(),
                            block_urls: formattedUrl,
                            redirect_urls: formattedRedirectUrl,
                            message: values.message?.trim() || "",
                            calender_url: values.calender_url?.trim() || "",
                            is_temporary: values.is_temporary === "true",
                            // Handle temporary vs default time synchronization
                            temporary_time: values.minutesToUnblock,
                            default_time: values.is_temporary === "true" ? 
                                (values.default_time || "0") : values.minutesToUnblock,
                            minutes_to_unblock: values.minutesToUnblock,
                            today_limit: isInstantBlock ? "0" : values.minutesToUnblock,
                            visited: isInstantBlock ? "true" : "false",
                            used_time: "0.00",
                            time: "0.00",
                            half_time_notified: "false",
                            one_quarter_notified: "false",
                            three_quarter_notified: "false",
                            source: 'api',
                            image: values.image ? response.data.data?.image || "" : ""
                        };
                        setAllBlockUrls(prev => [...prev, newUrl]);
                        setIsEmpty(false);

                        // Send message to background script for real-time updates
                        chrome.runtime.sendMessage({ type: 'URL_BLOCKED_UPDATE' });

                        // Reload all tabs that match the blocked URL if instant block (0 minutes)
                        if (isInstantBlock) {
                            chrome.tabs.query({}, (tabs) => {
                                tabs.forEach(tab => {
                                    if (tab.url && tab.url.includes(formattedUrl)) {
                                        chrome.tabs.reload(tab.id);
                                    }
                                });
                            });
                        }

                        // Close modal immediately after successful submission
                        setTimeout(() => {
                            setIsAddModalOpen(false);
                            addForm.resetForm();
                            // Clear the modal message
                            setModalMessage({ type: "", message: "" });
                            // Clear file input if exists
                            if (addFileInputRef.current) {
                                addFileInputRef.current.value = "";
                            }
                            // WebSocket will handle data refresh automatically
                        }, 500);
                    }
                } else {
                    // Non-authenticated user - use local storage
                    const blockedUrls = await new Promise(resolve => {
                        chrome.storage.local.get('blocked_urls', result => resolve(result.blocked_urls || []));
                    });

                    // Check if URL already exists
                    if (blockedUrls.some(item => item.block_urls === formattedUrl)) {
                        throw new Error("URL already exists in block list");
                    }

                    // Create new URL object
                    const isInstantBlock = values.minutesToUnblock == 0;
                    console.log('Creating new URL with values:', {
                        minutesToUnblock: values.minutesToUnblock,
                        is_temporary: values.is_temporary
                    });
                    const newUrl = {
                        id: generateUniqueId(),
                        block_urls: formattedUrl,
                        redirect_urls: formattedRedirectUrl,
                        message: values.message?.trim() || "",
                        calender_url: values.calender_url?.trim() || "",
                        is_temporary: values.is_temporary === "true",
                        // Handle temporary vs default time synchronization
                        temporary_time: values.minutesToUnblock,
                        default_time: values.is_temporary === "true" ? 
                            (values.default_time || "0") : values.minutesToUnblock,
                        minutes_to_unblock: values.minutesToUnblock,
                        today_limit: isInstantBlock ? "0" : values.minutesToUnblock,
                        visited: isInstantBlock ? "true" : "false",
                        used_time: 0,
                        time: 0,
                        half_time_notified: false,
                        one_quarter_notified: false,
                        three_quarter_notified: false,
                        created_at: new Date().toISOString(),
                        updated_at: new Date().toISOString(),
                        timezone: userTimezone,
                        source: 'local'
                    };
                    
                    console.log('Final newUrl object:', newUrl);
                    console.log('today_limit value:', newUrl.today_limit);

                    // Save to storage
                    await new Promise(resolve => {
                        chrome.storage.local.set({
                            'blocked_urls': [...blockedUrls, newUrl]
                        }, resolve);
                    });

                    // Set success message in the modal first, then close after a delay
                    setModalMessage({ message: "Website blocked successfully", type: "success" });

                    // Reset notification states for this URL to ensure clean state
                    chrome.runtime.sendMessage({
                        type: 'RESET_NOTIFICATION_STATES',
                        blockUrl: formattedUrl
                    }).catch(err => console.warn("Error resetting notification states:", err));
                    
                    // Mark this URL for notification reset in case it was recently deleted
                    try {
                        const { default: redirectManager } = await import('../../pages/Background/modules/redirectManager');
                        redirectManager.markForNotificationReset(formattedUrl);
                    } catch (importError) {
                        console.warn('Could not import redirectManager for local storage:', importError);
                    }

                    // Send message to background script for real-time updates
                    chrome.runtime.sendMessage({ type: 'URL_BLOCKED_UPDATE' });

                    // Reload all tabs that match the blocked URL if instant block (0 minutes)
                    if (isInstantBlock) {
                        chrome.tabs.query({}, (tabs) => {
                            tabs.forEach(tab => {
                                if (tab.url && tab.url.includes(formattedUrl)) {
                                    chrome.tabs.reload(tab.id);
                                }
                            });
                        });
                    }

                    // Update local state immediately
                    setAllBlockUrls(prev => [...prev, newUrl]);
                    setIsEmpty(false);

                    // Close modal immediately after successful submission
                    setTimeout(() => {
                        setIsAddModalOpen(false);
                        addForm.resetForm();
                        setModalMessage({ type: "", message: "" });
                    }, 500);
                }
            } catch (error) {
                console.error("Error adding URL:", error);
                // Use modalMessage instead of message so error shows inside the modal
                if (error.response?.data?.code === "URL_EXISTS") {
                    setModalMessage({message: 'You already added this website', type: "error"});
                } else if (error.response?.data?.code === "Subscriptions_Expired") {
                    setModalMessage({
                        message: 'Subscriptions expired. Click here to upgrade premium', 
                        type: "error",
                        onClick: () => chrome.tabs.create({url: 'https://focusly.pro/#plans'})
                    });
                } else if (error.response?.data?.data?.is_subcription_ended ) {
                    setModalMessage({
                        message: 'You can only block 5 sites for free. Click here to upgrade premium',
                        type: "error",
                        onClick: () => chrome.tabs.create({url: 'https://focusly.pro/#plans'})
                    });
                } else {
                    setModalMessage({
                        message: error.message || "Failed to add website",
                        type: "error"
                    });
                }
            } finally {
                setIsLoading(false);
            }
        }
    });

    useEffect(() => {
        fetchData();

        // Initialize WebSocket service for real-time updates
        const initializeWebSocket = async () => {
            if (token) {
                try {
                    await webSocketApiService.initialize();
                    console.log('WebSocket service initialized for Options page');

                    // Set up real-time URL list updates
                    webSocketApiService.onUrlsUpdated(async (urls) => {
                        console.log('Real-time URL list update received:', urls.length, 'URLs');
                        console.log('🔍 WEBSOCKET REAL-TIME DATA:', JSON.stringify(urls, null, 2));
                        
                        // Get current local URLs to maintain proper sync status
                        const localUrls = await new Promise(resolve => {
                            chrome.storage.local.get('blocked_urls', (result) => {
                                resolve(result.blocked_urls || []);
                            });
                        });
                        
                        // Apply sync logic to maintain correct source labels
                        const syncedUrls = await syncLocalStorageWithAPI(urls.map(url => ({ ...url, source: 'api' })), localUrls);
                        setAllBlockUrls(syncedUrls);
                        setIsEmpty(syncedUrls.length === 0);
                    });

                    // Set up real-time individual URL updates
                    webSocketApiService.onUrlUpdated((urlData) => {
                        console.log('Real-time URL update received:', urlData.id, 'visited:', urlData.visited);
                        console.log('🔍 INDIVIDUAL URL UPDATE DATA:', JSON.stringify(urlData, null, 2));

                        // Update the specific URL in the list immediately
                        setAllBlockUrls(prevUrls => {
                            const updatedUrls = prevUrls.map(url => {
                                if (url.id === urlData.id) {
                                    const updatedUrl = { ...url, ...urlData };
                                    console.log(`UI Update: ${url.block_urls} visited changed from ${url.visited} to ${urlData.visited}`);
                                    return updatedUrl;
                                }
                                return url;
                            });
                            return updatedUrls;
                        });
                    });
                } catch (error) {
                    console.error('Failed to initialize WebSocket service:', error);
                }
            }
        };

        initializeWebSocket();

        // Listen for storage changes (login/logout and blocked URLs)
        const handleStorageChange = (changes, namespace) => {
            if (namespace === 'local' && changes.blocked_urls) {
                console.log('Blocked URLs changed in storage, refreshing options page');
                // setMessage({ message: "Blocked websites updated! Refreshing...", type: "info" });
                // Update state directly from storage instead of API call
                setAllBlockUrls(changes.blocked_urls.newValue || []);
                setIsEmpty((changes.blocked_urls.newValue || []).length === 0);
                // Clear the message after 2 seconds
                setTimeout(() => {
                    setMessage({ message: "", type: "" });
                }, 2000);
            }
            
            const newToken = localStorage.getItem("access_token");
            if (newToken !== token) {
                setToken(newToken);
                // Only fetch data when token changes (login/logout)
                fetchData();

                // Reinitialize WebSocket with new token
                if (newToken) {
                    initializeWebSocket();
                } else {
                    // Disconnect WebSocket when logged out
                    webSocketApiService.disconnect();
                }
            }
        };

        // Listen for URL update messages
        const handleMessage = (message) => {
            if (message.type === 'URL_BLOCKED_UPDATE') {
                // Refresh data when URL is added from popup or other sources
                console.log('URL blocked update received - refreshing data');
                fetchData();
            } else if (message.type === 'LOCAL_URL_ADDED') {
                // Local storage changes are handled by storage listener
                console.log('Local URL added, storage listener will handle refresh:', message.url);
                setMessage({ message: "Website blocked! Refreshing list...", type: "info" });
                fetchData(); // Refresh immediately for local URLs
                // Clear the message after 2 seconds
                setTimeout(() => {
                    setMessage({ message: "", type: "" });
                }, 2000);
            }
        };

        // Listen for WebSocket URL updates via background script messages
        const handleWebSocketMessage = (message) => {
            if (message.type === 'WEBSOCKET_URL_UPDATE') {
                console.log('WebSocket URL update received - handled by WebSocket service directly');
                // WebSocket service handles updates automatically, no manual fetch needed
            } else if (message.type === 'WEBSITE_BLOCKED') {
                console.log('Website blocked notification received:', message.data?.url?.block_urls);
                // Update the specific URL in the list immediately
                if (message.data?.url) {
                    setAllBlockUrls(prevUrls => {
                        const updatedUrls = prevUrls.map(url =>
                            url.id === message.data.url.id
                                ? { ...url, ...message.data.url }
                                : url
                        );
                        return updatedUrls;
                    });

                    // Show a brief notification that the website was blocked
                    setMessage({
                        message: `${message.data.url.block_urls} has been blocked due to time limit`,
                        type: "info"
                    });

                    // Clear the message after 3 seconds
                    setTimeout(() => {
                        setMessage({ message: "", type: "" });
                    }, 3000);
                }
            }
        };

        window.addEventListener('storage', handleStorageChange);
        chrome.runtime.onMessage.addListener(handleMessage);
        
        // Listen for chrome storage changes for immediate updates
        chrome.storage.onChanged.addListener(handleStorageChange);

        // Add WebSocket message listener
        if (chrome.runtime && chrome.runtime.onMessage) {
            chrome.runtime.onMessage.addListener(handleWebSocketMessage);
        }
        
        // Add options page reload listener
        const handleOptionsReload = (message) => {
            if (message.type === 'RELOAD_OPTIONS_PAGE_REQUEST') {
                console.log('Options page reload requested');
                window.location.reload();
            }
        };
        
        chrome.runtime.onMessage.addListener(handleOptionsReload);
        
        // Listen for real-time WebSocket updates
        const handleRealTimeUpdate = (message) => {
            if (message.type === 'WEBSOCKET_REALTIME_UPDATE' && message.data?.url) {
                console.log('🔴 REAL-TIME UPDATE received:', message.data.url);
                const urlData = message.data.url;
                
                // Immediately update UI with real-time data
                setAllBlockUrls(prevUrls => {
                    return prevUrls.map(url => 
                        url.id === urlData.id ? { ...url, ...urlData } : url
                    );
                });
            }
        };
        
        chrome.runtime.onMessage.addListener(handleRealTimeUpdate);

        return () => {
            window.removeEventListener('storage', handleStorageChange);
            chrome.runtime.onMessage.removeListener(handleMessage);
            chrome.storage.onChanged.removeListener(handleStorageChange);
            if (chrome.runtime && chrome.runtime.onMessage) {
                chrome.runtime.onMessage.removeListener(handleWebSocketMessage);
            }
            chrome.runtime.onMessage.removeListener(handleOptionsReload);

            // Cleanup WebSocket connections
            if (token) {
                webSocketApiService.disconnect();
            }
        };
    }, [token]);

    // Update showDefaultTime whenever editingUrl changes
    useEffect(() => {
        if (editingUrl) {
            // Always show temporary time input (false means show temporary)
            setShowDefaultTime(false);
        }
    }, [editingUrl]);

    // Debug: Log state changes
    useEffect(() => {
        console.log('allBlockUrls state changed:', allBlockUrls.map(url => ({ id: url.id, url: url.block_urls, source: url.source })));
    }, [allBlockUrls]);

    const syncLocalStorageWithAPI = async (apiUrls, localUrls) => {
        // Create a map to track unique URLs and their merged data
        const urlMap = new Map();

        // Create a function to normalize and ensure all states are consistent
        const normalizeUrlState = (url) => {
            return {
                ...url,
                // Normalize boolean or mixed type states to string
                visited: url.visited === true ? "true" :
                    url.visited === false ? "false" :
                        url.visited || "false",

                // Normalize notification states
                half_time_notified: url.half_time_notified === true ? "true" :
                    url.half_time_notified === false ? "false" :
                        url.half_time_notified || "false",

                one_quarter_notified: url.one_quarter_notified === true ? "true" :
                    url.one_quarter_notified === false ? "false" :
                        url.one_quarter_notified || "false",

                three_quarter_notified: url.three_quarter_notified === true ? "true" :
                    url.three_quarter_notified === false ? "false" :
                        url.three_quarter_notified || "false",

                // Ensure used_time is a number with exactly 2 decimal places
                used_time: parseFloat(parseFloat(url.used_time || url.time || 0).toFixed(2)).toFixed(2),

                // Ensure other critical fields have default values
                redirect_urls: url.redirect_urls || "",
                message: url.message || "",
                minutes_to_unblock: url.minutes_to_unblock || "0",
                is_temporary: url.is_temporary === true ? "true" :
                    url.is_temporary === false ? "false" :
                        url.is_temporary || "false",
                // Preserve default_time and temporary_time values
                default_time: url.default_time !== undefined ? url.default_time : "0",
                temporary_time: url.temporary_time !== undefined ? url.temporary_time : "0"
            };
        };

        // Create lookup maps for API URLs
        const apiUrlIds = new Set(apiUrls.map(url => url.id));
        const apiUrlsByBlockUrl = new Map(apiUrls.map(url => [url.block_urls, url]));
        const apiUrlsById = new Map(apiUrls.map(url => [url.id, url]));

        // First, process API URLs and add them to the map
        for (const apiUrl of apiUrls) {
            const processedApiUrl = normalizeUrlState(apiUrl);
            processedApiUrl.source = 'api'; // Always mark as 'api' since it exists on the server
            console.log(`Adding API URL to map: ${processedApiUrl.block_urls} with source: 'api'`);
            urlMap.set(processedApiUrl.block_urls, processedApiUrl);
        }

        // Then, process local URLs
        localUrls.forEach(localUrl => {
            const processedUrl = normalizeUrlState(localUrl);
            const existingApiUrl = urlMap.get(localUrl.block_urls);
            const apiUrlById = apiUrlsById.get(localUrl.id);

            console.log(`Processing local URL: ${localUrl.block_urls}, ID: ${localUrl.id}`);
            console.log(`  - existingApiUrl: ${!!existingApiUrl}`);
            console.log(`  - apiUrlById: ${!!apiUrlById}`);
            console.log(`  - apiUrlIds.has(${localUrl.id}): ${apiUrlIds.has(localUrl.id)}`);

            // Check if this local URL corresponds to an API URL by ID or block_urls
            const isApiUrl = existingApiUrl || apiUrlById || apiUrlIds.has(localUrl.id);

            if (isApiUrl) {
                // This URL exists in both local and API - prioritize API data when logged in
                const apiData = existingApiUrl || apiUrlById;
                console.log(`  -> Local URL ${localUrl.block_urls} exists in both local and API - prioritizing API data`);

                const mergedUrl = {
                    ...apiData, // Use API data as base
                    source: 'synced', // Mark as 'synced' since it exists in both places
                    // Use API data for all fields when logged in
                    visited: apiData?.visited || "false",
                    used_time: apiData?.used_time || "0.00",
                    time: apiData?.time || apiData?.used_time || "0.00",
                    half_time_notified: apiData?.half_time_notified || "false",
                    one_quarter_notified: apiData?.one_quarter_notified || "false",
                    three_quarter_notified: apiData?.three_quarter_notified || "false",
                    default_time: apiData?.default_time || "0",
                    temporary_time: apiData?.temporary_time || "0",
                    minutes_to_unblock: apiData?.minutes_to_unblock || "0",
                    today_limit: apiData?.today_limit || apiData?.temporary_time || apiData?.default_time || "0"
                };
                urlMap.set(localUrl.block_urls, mergedUrl);
            } else {
                // Purely local URL
                console.log(`  -> Adding purely local URL to map: ${processedUrl.block_urls} with source: 'local'`);
                processedUrl.source = 'local';
                urlMap.set(processedUrl.block_urls, processedUrl);
            }
        });

        // Check for API URLs that don't have local counterparts and mark them as 'api'
        apiUrls.forEach(apiUrl => {
            const existingInMap = urlMap.get(apiUrl.block_urls);
            if (existingInMap && existingInMap.source === 'synced') {
                // Already processed as synced
                return;
            }
            if (!localUrls.some(localUrl => localUrl.id === apiUrl.id || localUrl.block_urls === apiUrl.block_urls)) {
                // This API URL doesn't exist locally - mark as pure 'api'
                const processedApiUrl = normalizeUrlState(apiUrl);
                processedApiUrl.source = 'api';
                console.log(`API-only URL: ${apiUrl.block_urls} - marking as 'api'`);
                urlMap.set(apiUrl.block_urls, processedApiUrl);
            }
        });

        // Convert map back to array and ensure proper source assignment
        const syncedUrls = Array.from(urlMap.values()).map(url => {
            const normalizedUrl = normalizeUrlState(url);
            // Keep the source that was already determined during sync
            normalizedUrl.source = url.source;
            console.log(`Final URL: ${normalizedUrl.block_urls}, Source: ${normalizedUrl.source}`);
            return normalizedUrl;
        });

        // Update local storage with synced URLs
        await new Promise(resolve => {
            chrome.storage.local.set({ 'blocked_urls': syncedUrls }, resolve);
        });

        return syncedUrls;
    };

    const fetchData = async () => {
        setIsLoading(true);

        try {
            let apiUrls = [];
            let localUrls = [];

            // Retrieve local URLs first
            await new Promise(resolve => {
                chrome.storage.local.get('blocked_urls', (result) => {
                    localUrls = result.blocked_urls || [];
                    resolve();
                });
            });

            if (token) {
                // Authenticated user - get data from API
                try {
                    const response = await AxiosServices.get(ApiUrlServices.GET_URL_LIST);
                    apiUrls = response.data.data.urls || [];
                    console.log('🔍 DIRECT API RESPONSE:', JSON.stringify(response.data, null, 2));
                    console.log('🔍 API URLS EXTRACTED:', JSON.stringify(apiUrls, null, 2));
                } catch (apiError) {
                    console.error("Error fetching data from API:", apiError);
                }

                // Mark all API URLs with 'api' source before syncing
                const apiUrlsWithSource = apiUrls.map(url => ({ ...url, source: 'api' }));
                console.log('=== SYNC DEBUG START ===');
                console.log('API URLs count:', apiUrlsWithSource.length);
                console.log('Local URLs count:', localUrls.length);
                console.log('User token exists:', !!token);
                console.log('API URLs:', apiUrlsWithSource.map(url => ({ id: url.id, url: url.block_urls, source: url.source })));
                console.log('Local URLs:', localUrls.map(url => ({ id: url.id, url: url.block_urls, source: url.source })));
                const syncedUrls = await syncLocalStorageWithAPI(apiUrlsWithSource, localUrls);
                console.log('Synced URLs:', syncedUrls.map(url => ({ id: url.id, url: url.block_urls, source: url.source })));
                console.log('=== SYNC DEBUG END ===');
                console.log('Setting state with URLs:', syncedUrls.map(url => ({ id: url.id, url: url.block_urls, source: url.source })));
                setAllBlockUrls(syncedUrls);
                setIsEmpty(syncedUrls.length === 0);
                console.log('State should now have URLs with correct sources');
            } else {
                console.log('User logged out - processing local URLs only')
                // Non-authenticated user - use local storage data
                // Ensure all local sites have the source property set to 'local'
                const processedLocalUrls = localUrls.map(url => ({
                    ...url,
                    source: 'local'
                }));
                setAllBlockUrls(processedLocalUrls);
                setIsEmpty(processedLocalUrls.length === 0);
            }
        } catch (error) {
            console.error("Error fetching data:", error);

            // Get the most meaningful error message
            let errorMessage = "Error fetching blocked websites";

            if (error) {
                // Try different ways to get a useful message
                if (typeof error === 'string') {
                    errorMessage = error;
                } else if (error.toString && error.toString() !== '[object Object]') {
                    errorMessage = error.toString();
                } else if (error.message) {
                    errorMessage = error.message;
                } else if (error.data?.message) {
                    errorMessage = error.data.message;
                }
            }

            // If we still have a generic message and have status info, add it
            if (errorMessage === "Error fetching blocked websites" && error.status) {
                errorMessage = `Error fetching blocked websites (HTTP ${error.status})`;
            }

            setMessage({ message: errorMessage, type: "error" });
        } finally {
            setIsLoading(false);
        }
    };

    const editForm = useFormik({
        initialValues: {
            activeTabLink: editingUrl?.block_urls || "",
            redirectUrl: editingUrl?.redirect_urls || "",
            minutesToUnblock: editingUrl?.temporary_time || "0",
            default_time: editingUrl?.default_time || "0",
            message: editingUrl?.message || "",
            calender_url: editingUrl?.calender_url || "",
            is_temporary: "true",
            image: editingUrl?.image || "",
        },
        enableReinitialize: true,
        validateOnChange: true,
        validateOnBlur: true,
        validate: (values) => {
            const errors = {};

            if (!values.activeTabLink?.trim()) {
                errors.activeTabLink = "Website URL is required";
            } else if (values.activeTabLink.startsWith('chrome-extension://') ||
                       values.activeTabLink.startsWith('moz-extension://') ||
                       values.activeTabLink.startsWith('extension://')) {
                errors.activeTabLink = "Extension pages cannot be blocked";
            }

            // No validation errors for time values in edit mode - only warnings

            return errors;
        },
        onSubmit: async (values) => {
            // Get previous values to check if we need to reset time
            const previousTimeLimit = parseFloat(editingUrl?.minutes_to_unblock) || 0;
            const previousTimeUsed = parseFloat(editingUrl?.time) || 0;
            const newTimeLimit = parseFloat(values.minutesToUnblock) || 0;

            // Only reset time if previous time limit was reached or exceeded,
            // OR if the new time limit is LESS THAN the previous one
            // const shouldResetTime = previousTimeUsed >= previousTimeLimit || 
            //                    newTimeLimit < previousTimeLimit;

            // // Show appropriate confirmation dialog
            // let confirmMessage = shouldResetTime
            //     ? "Warning: Updating this website will reset the accumulated time to zero because the new time limit is smaller or you've already reached the previous time limit. Do you want to continue?"
            //     : "You're increasing the time limit. The accumulated time will be preserved. Do you want to continue?";

            // const confirmUpdate = window.confirm(confirmMessage);

            // if (!confirmUpdate) {
            //     return; // User cancelled the update
            // }

            setIsLoading(true);

            try {
                if (token) {
                    // Authenticated user - update via API
                    try {
                        console.log("Updating item with ID:", editingUrl.id);
                        console.log("API endpoint:", ApiUrlServices.UPDATE_BLOCKED_ITEM(editingUrl.id));

                        // Get the current URL data to check time usage
                        const currentDataResponse = await AxiosServices.get(ApiUrlServices.GET_URL_LIST);
                        const allUrls = currentDataResponse.data.data.urls || [];
                        const currentUrl = allUrls.find(url => url.id === editingUrl.id);

                        // Format both URLs properly
                        const formattedBlockUrl = formatUrl(values.activeTabLink.trim());
                        if (!formattedBlockUrl) {
                            throw new Error("Invalid Website URL");
                        }

                        // Format the redirect URL if provided
                        const formattedRedirectUrl = values.redirectUrl.trim() ? formatUrl(values.redirectUrl.trim()) : "";
                        if (values.redirectUrl.trim() && !formattedRedirectUrl) {
                            throw new Error("Invalid Redirect URL");
                        }

                        // Check if previous time limit was fully consumed
                        const previousTimeUsed = parseFloat(currentUrl?.time) || 0;
                        const previousTimeLimit = parseFloat(currentUrl?.minutes_to_unblock) || 0;
                        const newTimeLimit = parseFloat(values.minutesToUnblock) || 0;

                        // Only reset time to 0 if previous time limit was reached or exceeded
                        // OR if the new time limit is LESS THAN the previous one
                        const shouldResetTime = values.is_temporary === "true" && (
                            previousTimeUsed >= previousTimeLimit ||
                            newTimeLimit < previousTimeLimit
                        );

                        console.log(`Update check in API section: previousTime=${previousTimeUsed}, previousLimit=${previousTimeLimit}, newLimit=${newTimeLimit}, shouldReset=${shouldResetTime}`);

                        const formData = new FormData();
                        formData.append("block_urls", formattedBlockUrl);
                        formData.append("redirect_urls", formattedRedirectUrl);
                        formData.append("is_temporary", String(values.is_temporary || "true").trim());

                        const userTimezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
                        formData.append("timezone", userTimezone);

                        // Handle temporary vs default time
                        if (values.is_temporary === "false") {
                            formData.append("default_time", String(values.default_time || "0").trim());
                            // When updating default_time, set temporary_time to match
                            formData.append("temporary_time", String(values.default_time || "0").trim());

                            // Check if we're increasing the default time for a blocked site
                            const oldDefaultTime = parseFloat(currentUrl?.default_time || 0);
                            const newDefaultTime = parseFloat(values.default_time || 0);
                            const currentVisited = currentUrl?.visited === "true" || currentUrl?.visited === true;
                            const currentTimeUsed = parseFloat(currentUrl?.used_time || currentUrl?.time || 0);

                            console.log(`Default time update: oldTime=${oldDefaultTime}, newTime=${newDefaultTime}, currentTimeUsed=${currentTimeUsed}, isCurrentlyBlocked=${currentVisited}`);

                            // Check if user has already consumed time relative to old time limit
                            const percentageUsed = (currentTimeUsed / oldDefaultTime) * 100;
                            console.log(`Percentage used: ${percentageUsed}% of old time limit`);

                            // Track the original time limit this site first had before any changes
                            const originalTimeLimit = parseFloat(currentUrl?.original_time_limit || oldDefaultTime);
                            console.log(`Original time limit: ${originalTimeLimit}, old time: ${oldDefaultTime}, new time: ${newDefaultTime}`);

                            // CRITICAL FIX: If we're decreasing the time limit and user has already used more than new limit
                            if (newDefaultTime < currentTimeUsed) {
                                console.log(`Immediately blocking site - default time (${newDefaultTime}) is < used time (${currentTimeUsed})`);
                                formData.append("visited", "true"); // Block the site immediately
                            }
                            // If we're returning to a previous time limit that wasn't fully consumed yet
                            else if (newDefaultTime < oldDefaultTime && currentTimeUsed < newDefaultTime &&
                                originalTimeLimit === newDefaultTime && currentTimeUsed < originalTimeLimit) {
                                console.log(`Returning to previous time limit ${newDefaultTime} that wasn't fully consumed. Not blocking.`);
                                formData.append("visited", "false"); // Don't block the site

                                // Reset notification states since we're changing time limit
                                formData.append("half_time_notified", "false");
                                formData.append("one_quarter_notified", "false");
                                formData.append("three_quarter_notified", "false");

                                // Store the original time limit to track this special case
                                formData.append("original_time_limit", String(originalTimeLimit));
                            }
                            // If we're increasing the time limit for a blocked site, unblock it
                            else if (currentVisited && newDefaultTime > oldDefaultTime) {
                                console.log(`Unblocking site - default time increased from ${oldDefaultTime} to ${newDefaultTime}`);
                                formData.append("visited", "false"); // Unblock the site

                                // Reset all notification states for fresh tracking
                                formData.append("half_time_notified", "false");
                                formData.append("one_quarter_notified", "false");
                                formData.append("three_quarter_notified", "false");
                            } else {
                                // Otherwise preserve the current visited state
                                formData.append("visited", currentUrl?.visited || "false");

                                // Recalculate notification states based on new percentage
                                const currentTimeUsedMs = currentTimeUsed * 60 * 1000; // Convert minutes to ms
                                const newTimeLimitMs = newDefaultTime * 60 * 1000; // Convert minutes to ms
                                const newPercentageUsed = (currentTimeUsedMs / newTimeLimitMs) * 100;
                                console.log(`New percentage used with updated time limit: ${newPercentageUsed}%`);

                                // Update notification states based on the new percentage
                                const halfTimeThreshold = 50;
                                const threeQuarterThreshold = 75;

                                const newHalfTimeNotified = newPercentageUsed >= halfTimeThreshold ? "true" : "false";
                                const newOneQuarterNotified = newPercentageUsed >= threeQuarterThreshold ? "true" : "false";
                                
                                formData.append("half_time_notified", newHalfTimeNotified);
                                formData.append("one_quarter_notified", newOneQuarterNotified);
                                formData.append("three_quarter_notified", "false");
                                
                                // Update blockerNotificationStates in extension storage
                                chrome.storage.local.get('blockerNotificationStates', (result) => {
                                    const currentStates = result.blockerNotificationStates || {};
                                    const normalizedUrl = formattedBlockUrl.replace(/\/$/, '');
                                    currentStates[normalizedUrl] = {
                                        halfTimeShown: newHalfTimeNotified === "true",
                                        oneQuarterShown: newOneQuarterNotified === "true",
                                        threeQuarterShown: false
                                    };
                                    chrome.storage.local.set({ 'blockerNotificationStates': currentStates });
                                });
                            }
                        } else {
                            formData.append("temporary_time", String(values.minutesToUnblock || "0").trim());
                            // Keep existing default_time unchanged when updating temporary_time
                            formData.append("default_time", String(currentUrl?.default_time || "0").trim());

                            // Check if we're decreasing the time limit for a blocked site
                            const oldTempTime = parseFloat(currentUrl?.minutes_to_unblock || 0);
                            const newTempTime = parseFloat(values.minutesToUnblock || 0);
                            const currentVisited = currentUrl?.visited === "true" || currentUrl?.visited === true;
                            const currentTimeUsed = parseFloat(currentUrl?.used_time || currentUrl?.time || 0);

                            console.log(`Temporary time update: oldTime=${oldTempTime}, newTime=${newTempTime}, currentTimeUsed=${currentTimeUsed}, isCurrentlyBlocked=${currentVisited}`);

                            // FIXED LOGIC: Compare new time limit with actual used time
                            const currentUsedTime = parseFloat(currentUrl?.used_time || currentUrl?.time || 0);
                            console.log(`API Update - Comparing newTempTime (${newTempTime}) with currentUsedTime (${currentUsedTime})`);
                            
                            if (newTempTime < currentUsedTime) {
                                console.log(`Setting visited=true because temporary time (${newTempTime}) is < used time (${currentUsedTime})`);
                                formData.append("visited", "true");
                                formData.append("time", parseFloat(currentUsedTime).toFixed(2)); // Preserve accumulated time
                            }
                            // If we're increasing the time limit for a blocked site, unblock it
                            else if (currentVisited && newTempTime > currentUsedTime) {
                                console.log(`Unblocking site - temporary time increased from ${oldTempTime} to ${newTempTime}, used time: ${currentUsedTime}`);
                                formData.append("visited", "false"); // Unblock the site

                                // Reset all notification states for fresh tracking
                                formData.append("half_time_notified", "false");
                                formData.append("one_quarter_notified", "false");
                                formData.append("three_quarter_notified", "false");
                            } else {
                                // Otherwise preserve the current visited state and time
                                formData.append("visited", currentUrl?.visited || "false");

                                // Recalculate notification states based on new percentage
                                const currentTimeUsedMs = currentTimeUsed * 60 * 1000; // Convert minutes to ms
                                const newTimeLimitMs = newTempTime * 60 * 1000; // Convert minutes to ms
                                const newPercentageUsed = (currentTimeUsedMs / newTimeLimitMs) * 100;
                                console.log(`New percentage used with updated time limit: ${newPercentageUsed}%`);

                                // Update notification states based on the new percentage
                                const halfTimeThreshold = 50;
                                const threeQuarterThreshold = 75;

                                const newHalfTimeNotified = newPercentageUsed >= halfTimeThreshold ? "true" : "false";
                                const newOneQuarterNotified = newPercentageUsed >= threeQuarterThreshold ? "true" : "false";
                                
                                formData.append("half_time_notified", newHalfTimeNotified);
                                formData.append("one_quarter_notified", newOneQuarterNotified);
                                formData.append("three_quarter_notified", "false");
                                
                                // Update blockerNotificationStates in extension storage
                                chrome.storage.local.get('blockerNotificationStates', (result) => {
                                    const currentStates = result.blockerNotificationStates || {};
                                    const normalizedUrl = formattedBlockUrl.replace(/\/$/, '');
                                    currentStates[normalizedUrl] = {
                                        halfTimeShown: newHalfTimeNotified === "true",
                                        oneQuarterShown: newOneQuarterNotified === "true",
                                        threeQuarterShown: false
                                    };
                                    chrome.storage.local.set({ 'blockerNotificationStates': currentStates });
                                });

                                // Preserve accumulated time
                                formData.append("time", parseFloat(currentUrl?.time || 0).toFixed(2));
                            }
                        }

                        formData.append("message", values.message?.trim() || "");

                        formData.append("calender_url", values.calender_url?.trim() || "");
                        
                        // Set today_limit to 0 when blocking instantly (when time is set to 0)
                        const isInstantBlockEdit = (values.is_temporary === "false" ? values.default_time : values.minutesToUnblock) == 0;
                        formData.append("today_limit", isInstantBlockEdit ? "0" : (values.is_temporary === "false" ? values.default_time : values.minutesToUnblock));

                        // Only set imageUpdate to true if there's a new image selected
                        if (values.image && values.image instanceof File) {
                            formData.append("image", values.image);
                            formData.append("imageUpdate", "true");
                        }

                        // For debugging, log the FormData entries
                        console.log("Form data entries:");
                        for (let pair of formData.entries()) {
                            console.log(pair[0] + ": " + pair[1]);
                        }

                        const response = await AxiosServices.put(
                            ApiUrlServices.UPDATE_BLOCKED_ITEM(editingUrl.id),
                            formData,
                            true
                        );

                        console.log("API update response:", response);

                        // After API update, directly fetch the URLs to ensure we have the most current data
                        const currentUrls = await AxiosServices.get(ApiUrlServices.GET_URL_LIST);
                        const serverUrls = currentUrls.data.data.urls || [];

                        // Get the updated block URL (the new URL value after editing)
                        const updatedBlockUrl = values.activeTabLink.trim();

                        // Get the local URLs
                        const localStorageResult = await new Promise((resolve) => {
                            chrome.storage.local.get('blocked_urls', (storage) => {
                                const blockedUrls = storage.blocked_urls || [];

                                // Create a set of server URL IDs for fast lookup
                                const serverUrlIds = new Set(serverUrls.map(url => url.id));

                                // Filter the local URLs to:
                                // 1. Keep any URL whose ID matches our edited ID 
                                // 2. Remove any URL with the same block_urls as our new URL but different ID
                                // 3. Keep any URL that exists on the server (by ID)
                                // 4. Keep any purely local URLs
                                const cleanedUrls = blockedUrls.filter(url => {
                                    // Keep if it's our edited URL with matching ID
                                    if (url.id === editingUrl.id) {
                                        console.log("Keeping our edited URL", url.id);
                                        return true;
                                    }

                                    // Remove if it has the same block_urls as our edited URL but different ID
                                    if (url.block_urls === updatedBlockUrl && url.id !== editingUrl.id) {
                                        console.log("Removing duplicate URL with block_urls:", url.block_urls);
                                        return false;
                                    }

                                    // Keep if it's a URL that exists on the server
                                    if (serverUrlIds.has(url.id)) {
                                        return true;
                                    }

                                    // Keep if it's a purely local URL (source = 'local')
                                    if (url.source === 'local') {
                                        return true;
                                    }

                                    // Otherwise, it's likely a stale URL, remove it
                                    console.log("Removing stale URL:", url.id, url.block_urls);
                                    return false;
                                });

                                // If we filtered out any URLs, save the updated list
                                if (cleanedUrls.length !== blockedUrls.length) {
                                    console.log(`Removed ${blockedUrls.length - cleanedUrls.length} duplicate or stale URLs`);
                                    chrome.storage.local.set({ 'blocked_urls': cleanedUrls }, () => {
                                        resolve();
                                    });
                                } else {
                                    resolve();
                                }
                            });
                        });

                        // Get current local URLs for proper synchronization
                        const currentLocalUrls = await new Promise(resolve => {
                            chrome.storage.local.get('blocked_urls', result => resolve(result.blocked_urls || []));
                        });

                        // Now re-synchronize the URLs to make sure everything is consistent
                        await syncLocalStorageWithAPI(serverUrls, currentLocalUrls);
                    } catch (apiError) {
                        console.error("API update failed:", apiError);
                        throw apiError; // Re-throw to be caught by the outer catch
                    }
                } else {
                    // Non-authenticated user - update in local storage
                    const result = await new Promise((resolve, reject) => {
                        chrome.storage.local.get('blocked_urls', (storage) => {
                            const blockedUrls = storage.blocked_urls || [];

                            // Find the index of the URL being edited
                            const urlIndex = blockedUrls.findIndex(url => url.id === editingUrl.id);

                            if (urlIndex !== -1) {
                                // Check if previous time limit was fully consumed
                                const previousUrl = blockedUrls[urlIndex];
                                const previousTimeUsed = parseFloat(previousUrl.time) || 0;
                                const previousTimeLimit = parseFloat(previousUrl.minutes_to_unblock) || 0;

                                // Only reset time to 0 if previous time limit was reached or exceeded
                                // OR if the new time limit is LESS THAN the previous one
                                // AND only if is_temporary is true
                                const newTimeLimit = parseFloat(values.minutesToUnblock) || 0;
                                const shouldResetTime = values.is_temporary === "true" && (
                                    previousTimeUsed >= previousTimeLimit ||
                                    newTimeLimit < previousTimeLimit
                                );

                                console.log(`Update check in Options: previousTime=${previousTimeUsed}, previousLimit=${previousTimeLimit}, newLimit=${newTimeLimit}, shouldReset=${shouldResetTime}`);

                                let half_time_notified = "false";
                                let one_quarter_notified = "false";
                                let three_quarter_notified = "false";

                                // If we're not resetting time, calculate notification states based on new percentage
                                if (!shouldResetTime) {
                                    // Calculate the current percentage of time used with the new time limit
                                    const timeUsedMs = previousTimeUsed * 60 * 1000; // Convert minutes to ms
                                    const newTimeLimitMs = newTimeLimit * 60 * 1000; // Convert minutes to ms
                                    const newPercentageUsed = (timeUsedMs / newTimeLimitMs) * 100;
                                    console.log(`New percentage used with updated time limit: ${newPercentageUsed}%`);

                                    // Update notification states based on the new percentage
                                    const halfTimeThreshold = 50;
                                    const threeQuarterThreshold = 75;

                                    half_time_notified = newPercentageUsed >= halfTimeThreshold ? "true" : "false";
                                    one_quarter_notified = newPercentageUsed >= threeQuarterThreshold ? "true" : "false";
                                    three_quarter_notified = "false"; // This isn't used but included for consistency
                                }
                                const userTimezone = Intl.DateTimeFormat().resolvedOptions().timeZone;


                                // Update the URL data
                                const isInstantBlockEdit = (values.is_temporary === "false" ? values.default_time : values.minutesToUnblock) == 0;
                                const updatedUrl = {
                                    ...blockedUrls[urlIndex],
                                    block_urls: values.activeTabLink.trim(),
                                    redirect_urls: values.redirectUrl.trim() || "",
                                    message: values.message.trim(),

                                    calender_url: values.calender_url?.trim() || "",
                                    is_temporary: String(values.is_temporary).trim(),
                                    updated_at: new Date().toISOString(),
                                    timezone: userTimezone,
                                    today_limit: isInstantBlockEdit ? "0" : (values.is_temporary === "false" ? values.default_time : values.minutesToUnblock),
                                };

                                // Handle temporary vs default time
                                if (values.is_temporary === "false") {
                                    updatedUrl.default_time = String(values.default_time || "0").trim();
                                    // When updating default_time, set temporary_time to match
                                    updatedUrl.temporary_time = String(values.default_time || "0").trim();
                                    updatedUrl.minutes_to_unblock = String(values.default_time || "0").trim();

                                    // Check if we're increasing the default time for a blocked site
                                    const oldDefaultTime = parseFloat(previousUrl?.default_time || 0);
                                    const newDefaultTime = parseFloat(values.default_time || 0);
                                    const currentVisited = previousUrl?.visited === "true" || previousUrl?.visited === true;
                                    const currentTimeUsed = parseFloat(previousUrl?.time || 0);

                                    console.log(`Default time update (local storage): oldTime=${oldDefaultTime}, newTime=${newDefaultTime}, currentTimeUsed=${currentTimeUsed}, isCurrentlyBlocked=${currentVisited}`);

                                    // Check if user has already consumed time relative to old time limit
                                    const percentageUsed = (currentTimeUsed / oldDefaultTime) * 100;
                                    console.log(`Percentage used: ${percentageUsed}% of old time limit`);

                                    // Track the original time limit this site first had before any changes
                                    const originalTimeLimit = parseFloat(previousUrl?.original_time_limit || oldDefaultTime);
                                    console.log(`Original time limit: ${originalTimeLimit}, old time: ${oldDefaultTime}, new time: ${newDefaultTime}`);

                                    // CRITICAL FIX: If we're decreasing the time limit and user has already used more than new limit
                                    if (newDefaultTime < currentTimeUsed) {
                                        console.log(`Immediately blocking site - default time (${newDefaultTime}) is < used time (${currentTimeUsed})`);
                                        updatedUrl.visited = "true"; // Block the site immediately

                                        // Keep the actual time tracking
                                        updatedUrl.time = parseFloat(currentTimeUsed).toFixed(2);

                                        // Keep notification states as they are
                                        updatedUrl.half_time_notified = previousUrl.half_time_notified;
                                        updatedUrl.one_quarter_notified = previousUrl.one_quarter_notified;
                                        updatedUrl.three_quarter_notified = previousUrl.three_quarter_notified;
                                    }
                                    // If we're returning to a previous time limit that wasn't fully consumed yet
                                    else if (newDefaultTime < oldDefaultTime && currentTimeUsed < newDefaultTime &&
                                        originalTimeLimit === newDefaultTime && currentTimeUsed < originalTimeLimit) {
                                        console.log(`Returning to previous time limit ${newDefaultTime} that wasn't fully consumed. Not blocking.`);
                                        updatedUrl.visited = "false"; // Don't block the site

                                        // Reset notification states since we're changing time limit
                                        updatedUrl.half_time_notified = "false";
                                        updatedUrl.one_quarter_notified = "false";
                                        updatedUrl.three_quarter_notified = "false";

                                        // Store the original time limit to track this special case
                                        updatedUrl.original_time_limit = String(originalTimeLimit);
                                    }
                                    // If we're increasing the time limit for a blocked site, unblock it
                                    else if (currentVisited && newDefaultTime > oldDefaultTime) {
                                        console.log(`Unblocking site - default time increased from ${oldDefaultTime} to ${newDefaultTime}`);
                                        updatedUrl.visited = "false"; // Unblock the site

                                        // Reset all notification states for fresh tracking
                                        updatedUrl.half_time_notified = "false";
                                        updatedUrl.one_quarter_notified = "false";
                                        updatedUrl.three_quarter_notified = "false";
                                    } else {
                                        // Otherwise preserve the current visited state
                                        updatedUrl.visited = previousUrl.visited;

                                        // Recalculate notification states based on new percentage
                                        const currentTimeUsedMs = currentTimeUsed * 60 * 1000; // Convert minutes to ms
                                        const newTimeLimitMs = newDefaultTime * 60 * 1000; // Convert minutes to ms
                                        const newPercentageUsed = (currentTimeUsedMs / newTimeLimitMs) * 100;
                                        console.log(`New percentage used with updated time limit: ${newPercentageUsed}%`);

                                        // Update notification states based on the new percentage
                                        const halfTimeThreshold = 50;
                                        const threeQuarterThreshold = 75;

                                        const newHalfTimeNotified = newPercentageUsed >= halfTimeThreshold ? "true" : "false";
                                        const newOneQuarterNotified = newPercentageUsed >= threeQuarterThreshold ? "true" : "false";
                                        
                                        updatedUrl.half_time_notified = newHalfTimeNotified;
                                        updatedUrl.one_quarter_notified = newOneQuarterNotified;
                                        updatedUrl.three_quarter_notified = "false";
                                        
                                        // Update blockerNotificationStates in extension storage
                                        chrome.storage.local.get('blockerNotificationStates', (result) => {
                                            const currentStates = result.blockerNotificationStates || {};
                                            const normalizedUrl = values.activeTabLink.trim().replace(/\/$/, '');
                                            currentStates[normalizedUrl] = {
                                                halfTimeShown: newHalfTimeNotified === "true",
                                                oneQuarterShown: newOneQuarterNotified === "true",
                                                threeQuarterShown: false
                                            };
                                            chrome.storage.local.set({ 'blockerNotificationStates': currentStates });
                                        });

                                        // Keep the time tracking
                                        updatedUrl.time = parseFloat(currentTimeUsed).toFixed(2);
                                    }
                                } else {
                                    updatedUrl.temporary_time = String(values.minutesToUnblock || "0").trim();
                                    // Keep existing default_time unchanged when updating temporary_time
                                    updatedUrl.default_time = String(previousUrl.default_time || "0").trim();
                                    updatedUrl.minutes_to_unblock = String(values.minutesToUnblock || "0").trim();

                                    // Check if we're manipulating the time limit for a blocked site
                                    const oldTempTime = parseFloat(previousUrl?.minutes_to_unblock || 0);
                                    const newTempTime = parseFloat(values.minutesToUnblock || 0);
                                    const currentVisited = previousUrl?.visited === "true" || previousUrl?.visited === true;
                                    const currentTimeUsed = parseFloat(previousUrl?.time || 0);

                                    console.log(`Temporary time update (local storage): oldTime=${oldTempTime}, newTime=${newTempTime}, currentTimeUsed=${currentTimeUsed}, isCurrentlyBlocked=${currentVisited}`);

                                    // FIXED LOGIC: Compare new time limit with actual used time
                                    const currentUsedTime = parseFloat(previousUrl?.used_time || previousUrl?.time || 0);
                                    console.log(`Local Storage Update - Comparing newTempTime (${newTempTime}) with currentUsedTime (${currentUsedTime})`);
                                    
                                    // CRITICAL FIX: For local users, if new time limit is less than or equal to used time, block the site
                                    if (newTempTime < currentUsedTime) {
                                        console.log(`Setting visited=true because temporary time (${newTempTime}) is < used time (${currentUsedTime})`);
                                        updatedUrl.visited = "true";

                                        // Keep the actual time tracking
                                        updatedUrl.time = parseFloat(currentUsedTime).toFixed(2);

                                        // Keep notification states as they are
                                        updatedUrl.half_time_notified = previousUrl.half_time_notified;
                                        updatedUrl.one_quarter_notified = previousUrl.one_quarter_notified;
                                        updatedUrl.three_quarter_notified = previousUrl.three_quarter_notified;
                                    }
                                    // If we're increasing the time limit for a blocked site, unblock it
                                    else if (currentVisited && newTempTime > currentUsedTime) {
                                        console.log(`Unblocking site - temporary time increased from ${oldTempTime} to ${newTempTime}, used time: ${currentUsedTime}`);
                                        updatedUrl.visited = "false"; // Unblock the site

                                        // Reset all notification states for fresh tracking
                                        updatedUrl.half_time_notified = "false";
                                        updatedUrl.one_quarter_notified = "false";
                                        updatedUrl.three_quarter_notified = "false";
                                    } else {
                                        // Otherwise preserve the current visited state
                                        updatedUrl.visited = previousUrl.visited;

                                        // Recalculate notification states based on new percentage
                                        const currentTimeUsedMs = currentTimeUsed * 60 * 1000; // Convert minutes to ms
                                        const newTimeLimitMs = newTempTime * 60 * 1000; // Convert minutes to ms
                                        const newPercentageUsed = (currentTimeUsedMs / newTimeLimitMs) * 100;
                                        console.log(`New percentage used with updated time limit: ${newPercentageUsed}%`);

                                        // Update notification states based on the new percentage
                                        const halfTimeThreshold = 50;
                                        const threeQuarterThreshold = 75;

                                        const newHalfTimeNotified = newPercentageUsed >= halfTimeThreshold ? "true" : "false";
                                        const newOneQuarterNotified = newPercentageUsed >= threeQuarterThreshold ? "true" : "false";
                                        
                                        updatedUrl.half_time_notified = newHalfTimeNotified;
                                        updatedUrl.one_quarter_notified = newOneQuarterNotified;
                                        updatedUrl.three_quarter_notified = "false";
                                        
                                        // Update blockerNotificationStates in extension storage
                                        chrome.storage.local.get('blockerNotificationStates', (result) => {
                                            const currentStates = result.blockerNotificationStates || {};
                                            const normalizedUrl = values.activeTabLink.trim().replace(/\/$/, '');
                                            currentStates[normalizedUrl] = {
                                                halfTimeShown: newHalfTimeNotified === "true",
                                                oneQuarterShown: newOneQuarterNotified === "true",
                                                threeQuarterShown: false
                                            };
                                            chrome.storage.local.set({ 'blockerNotificationStates': currentStates });
                                        });

                                        // Keep the time tracking
                                        updatedUrl.time = parseFloat(currentTimeUsed).toFixed(2);
                                    }
                                }

                                // Replace the old URL with the updated one
                                blockedUrls[urlIndex] = updatedUrl;

                                // Check if there are any other entries with the same block_urls
                                // This prevents duplicate URLs after editing
                                const duplicateIndex = blockedUrls.findIndex((url, index) =>
                                    index !== urlIndex && url.block_urls === updatedUrl.block_urls
                                );

                                if (duplicateIndex !== -1) {
                                    console.log(`Found duplicate URL at index ${duplicateIndex}, removing it`);
                                    // Remove the duplicate entry
                                    blockedUrls.splice(duplicateIndex, 1);
                                }

                                // Save back to storage
                                chrome.storage.local.set({ 'blocked_urls': blockedUrls }, (result) => {
                                    resolve(result);
                                });
                            } else {
                                reject(new Error("Item not found"));
                            }
                        });
                    });
                }

                // Common success handling
                // We no longer show success message after edits
                // setMessage({ message: "Item updated successfully", type: "success" });
                setEditingUrl(null);
                setIsBlockModalOpen(false);

                // Send message to reset time tracking when time limit is increased
                try {
                    const previousTimeLimit = parseFloat(editingUrl?.default_time || editingUrl?.temporary_time || editingUrl?.minutes_to_unblock) || 0;
                    const newTimeLimit = parseFloat(values.minutesToUnblock) || 0;
                    const isIncreasingTimeLimit = newTimeLimit > previousTimeLimit;

                    if (isIncreasingTimeLimit) {
                        console.log(`Time limit increased from ${previousTimeLimit} to ${newTimeLimit}, resetting time tracking`);
                        chrome.runtime.sendMessage({
                            type: "TEMPORARY_TIME_RESET",
                            url: values.activeTabLink.trim()
                        });
                    }
                } catch (msgError) {
                    console.warn("Failed to send time reset message:", msgError);
                }

                // Check if time was updated (either temporary_time or default_time)
                const previousTimeLimit = parseFloat(editingUrl?.default_time || editingUrl?.temporary_time || editingUrl?.minutes_to_unblock) || 0;
                const newTimeLimit = parseFloat(values.minutesToUnblock || values.default_time) || 0;
                const timeWasUpdated = newTimeLimit !== previousTimeLimit;

                if (timeWasUpdated) {
                    console.log(`Time limit updated from ${previousTimeLimit} to ${newTimeLimit}, processing update`);
                    
                    // Send message to background script to handle the time update properly
                    chrome.runtime.sendMessage({
                        type: "PRESERVE_TIME_AFTER_UPDATE",
                        url: values.activeTabLink.trim(),
                        shouldResetTime: false,
                        notificationStates: {
                            halfTimeShown: false,
                            oneQuarterShown: false
                        }
                    });
                    
                    // Fetch the latest API data immediately to ensure we have the most current state
                    try {
                        // Initialize WebSocket service if not already done
                        if (!webSocketApiService.isConnected()) {
                            await webSocketApiService.initialize();
                        }
                        
                        // Fetch latest URLs from API
                        await webSocketApiService.fetchUrls();
                        
                        // Also refresh the local data
                        await fetchData();
                        
                        console.log('Latest API data fetched successfully after time update');
                    } catch (fetchError) {
                        console.error('Error fetching latest API data after time update:', fetchError);
                    }

                    // Send message to background script to refresh its state
                    chrome.runtime.sendMessage({
                        type: "FORCE_REFRESH_URL_STATE",
                        url: values.activeTabLink.trim()
                    });
                }

                // Always reload tabs when site is updated (regardless of time changes)
                setTimeout(() => {
                    const blockUrl = values.activeTabLink.trim();
                    
                    chrome.tabs.query({}, (tabs) => {
                        const matchingTabs = tabs.filter(tab => 
                            tab.url && compareUrls(blockUrl, tab.url)
                        );
                        
                        if (matchingTabs.length > 0) {
                            console.log(`Reloading ${matchingTabs.length} matching tabs for updated URL: ${blockUrl}`);
                            matchingTabs.forEach(tab => {
                                chrome.tabs.reload(tab.id);
                            });
                        }
                    });
                }, 1000); // Reload tabs after 1 second

                // WebSocket and storage listeners will handle data synchronization
                // No manual fetch needed as updates are handled automatically
            } catch (error) {
                // Debug log to see the complete error structure
                console.error("Update error detailed inspection:", error);

                // Safe stringification of the error object
                try {
                    const safeProps = {};
                    // Extract non-circular properties
                    for (const key of Object.keys(error)) {
                        // Skip functions and potential circular references
                        if (typeof error[key] !== 'function' && key !== 'toJSON') {
                            try {
                                // Test if the property can be stringified
                                JSON.stringify(error[key]);
                                safeProps[key] = error[key];
                            } catch (e) {
                                safeProps[key] = '[Circular or Non-Serializable]';
                            }
                        }
                    }
                    console.error("Error safe properties:", safeProps);
                } catch (e) {
                    console.error("Failed to safely log error properties:", e);
                }

                // Get the most meaningful error message
                let errorMessage = "Failed to update the website";

                if (error) {
                    // Try different ways to get a useful message
                    if (typeof error === 'string') {
                        errorMessage = error;
                    } else if (error.toString && error.toString() !== '[object Object]') {
                        errorMessage = error.toString();
                    } else if (error.message) {
                        errorMessage = error.message;
                    } else if (error.data?.message) {
                        errorMessage = error.data.message;
                    }
                }

                // If we still have a generic message and have status info, add it
                if (errorMessage === "Failed to update the website" && error.status) {
                    errorMessage = `Failed to update the website (HTTP ${error.status})`;
                }

                setMessage({
                    message: errorMessage,
                    type: "error"
                });
            } finally {
                setIsLoading(false);
            }
        }
    });

    const handleDeleteClick = (id) => {
        // Find the URL to be deleted
        const urlToDelete = allBlockUrls.find((url) => url.id === id);

        if (!urlToDelete) {
            setMessage({
                message: "Item not found",
                type: "error"
            });
            return;
        }

        // Check if user is trying to delete an API/cloud item without being logged in
        if (!token && (urlToDelete.source === 'api' || urlToDelete.source === 'merged')) {
            setMessage({
                message: "This website is stored in the cloud. Please log in to delete it.",
                type: "warning"
            });
            return;
        }

        // Directly call deleteUrl since confirmation is handled in BlockItemCard
        return deleteUrl(id);
    };

    const deleteUrl = async (id) => {
        try {
            // Find the URL data before deletion
            const urlToDelete = allBlockUrls.find((url) => url.id === id);

            if (!urlToDelete) {
                throw new Error("URL not found");
            }

            // Extra protection - don't allow deleting cloud items when logged out
            if (!token && (urlToDelete.source === 'api' || urlToDelete.source === 'merged')) {
                throw new Error("You need to log in to delete websites stored in the cloud");
            }

            console.log(`Starting deletion process for URL: ${urlToDelete.block_urls} (ID: ${id})`);

            if (token && urlToDelete.source !== 'local') {
                // Authenticated user - delete from server (but not for local-only URLs)
                await AxiosServices.remove(ApiUrlServices.DELETE_BLOCKED_ITEM(id), true);
                console.log("URL deleted from server successfully");
            }

            // Always clean up local storage data thoroughly, regardless of auth state
            // This ensures all traces of the URL are removed
            try {
                // First, send cleanup message to background script BEFORE removing from storage
                // This ensures all time tracking and notification states are cleared
                await new Promise((resolve, reject) => {
                    chrome.runtime.sendMessage({
                        type: "CLEANUP_URL_DATA",
                        blockUrl: urlToDelete.block_urls,
                    }, (response) => {
                        if (chrome.runtime.lastError) {
                            console.warn("Background cleanup warning:", chrome.runtime.lastError);
                            resolve(); // Continue even if background cleanup fails
                        } else if (response && response.success) {
                            console.log("Background cleanup completed successfully");
                            resolve();
                        } else {
                            console.warn("Background cleanup failed:", response?.error);
                            resolve(); // Continue even if background cleanup fails
                        }
                    });
                });

                // Remove from local storage
                const blockedUrlsResult = await new Promise(resolve => {
                    chrome.storage.local.get('blocked_urls', resolve);
                });

                let blockedUrls = blockedUrlsResult.blocked_urls || [];
                const originalLength = blockedUrls.length;
                blockedUrls = blockedUrls.filter(url => url.id !== id);

                await new Promise(resolve => {
                    chrome.storage.local.set({ 'blocked_urls': blockedUrls }, resolve);
                });

                console.log(`URL removed from local storage: ${urlToDelete.block_urls} (${originalLength - blockedUrls.length} entries removed)`);

                // Additional cleanup - remove any notification states, time tracking, etc.
                const additionalCleanupKeys = [
                    'blockerNotificationStates',
                    'blockerUrlTimes', 
                    'blockerUrlAccumulatedTimes',
                    'blockerUrlStateTransitions',
                    'redirectManagerData',
                    'redirectManagerCounts'
                ];

                const cleanupResult = await new Promise(resolve => {
                    chrome.storage.local.get(additionalCleanupKeys, resolve);
                });

                const cleanupChanges = {};
                let totalCleaned = 0;

                // Clean up each storage key
                additionalCleanupKeys.forEach(key => {
                    if (cleanupResult[key] && typeof cleanupResult[key] === 'object') {
                        const cleaned = {...cleanupResult[key]};
                        let keysCleaned = 0;

                        Object.keys(cleaned).forEach(storageKey => {
                            // Check if this key relates to our deleted URL
                            if (storageKey.includes(urlToDelete.block_urls) || 
                                urlToDelete.block_urls.includes(storageKey) ||
                                storageKey === urlToDelete.block_urls) {
                                delete cleaned[storageKey];
                                keysCleaned++;
                            }
                        });

                        if (keysCleaned > 0) {
                            cleanupChanges[key] = cleaned;
                            totalCleaned += keysCleaned;
                            console.log(`Cleaned ${keysCleaned} entries from ${key}`);
                        }
                    }
                });

                // Save cleanup changes if any
                if (Object.keys(cleanupChanges).length > 0) {
                    await new Promise(resolve => {
                        chrome.storage.local.set(cleanupChanges, resolve);
                    });
                    console.log(`Additional cleanup completed: ${totalCleaned} total entries removed`);
                }

                // Force refresh the blocked URLs list in all open tabs
                chrome.runtime.sendMessage({
                    type: 'URL_BLOCKED_UPDATE'
                }).catch(err => console.warn("Error sending URL update message:", err));

            } catch (cleanupError) {
                console.warn("Error during cleanup, continuing with deletion:", cleanupError);
            }

            // Update the local state immediately
            const updatedUrls = allBlockUrls.filter(url => url.id !== id);
            setAllBlockUrls(updatedUrls);
            console.log(`Local state updated: ${allBlockUrls.length - updatedUrls.length} URLs removed from display`);

            // Reload tabs that match the deleted URL to unblock the site
            setTimeout(() => {
                chrome.tabs.query({}, (tabs) => {
                    const matchingTabs = tabs.filter(tab => 
                        tab.url && (
                            tab.url.includes(urlToDelete.block_urls) || 
                            urlToDelete.block_urls.includes(tab.url.split('?')[0]) ||
                            tab.url.replace(/^https?:\/\/(www\.)?/, '').includes(urlToDelete.block_urls.replace(/^https?:\/\/(www\.)?/, ''))
                        )
                    );
                    
                    if (matchingTabs.length > 0) {
                        console.log(`Reloading ${matchingTabs.length} tabs that match deleted URL: ${urlToDelete.block_urls}`);
                        matchingTabs.forEach(tab => {
                            chrome.tabs.reload(tab.id);
                        });
                    } else {
                        console.log(`No tabs found matching deleted URL: ${urlToDelete.block_urls}`);
                    }
                });
            }, 1500);

            console.log(`Deletion process completed successfully for: ${urlToDelete.block_urls}`);
            
        } catch (error) {
            console.error("Error deleting URL:", error);
            setMessage({ message: error.message || "Something went wrong", type: "error" });
            throw error; // Re-throw to handle in the component
        }
    }

    const deleteBannerImg = async (id) => {
        if (window.confirm("Are you sure you want to delete this banner?")) {
            setIsLoading(true);
            const formData = new FormData();
            formData.append("imageUpdate", "false");
            try {
                await AxiosServices.put(ApiUrlServices.UPDATE_BLOCKED_ITEM(id), formData, true);
                setMessage({ message: "Banner deleted successfully", type: "success" });
                // WebSocket will handle list refresh automatically
            } catch (error) {
                console.error("Error deleting banner:", error);

                // Get the most meaningful error message
                let errorMessage = "Failed to delete banner";

                if (error) {
                    // Try different ways to get a useful message
                    if (typeof error === 'string') {
                        errorMessage = error;
                    } else if (error.toString && error.toString() !== '[object Object]') {
                        errorMessage = error.toString();
                    } else if (error.message) {
                        errorMessage = error.message;
                    } else if (error.data?.message) {
                        errorMessage = error.data.message;
                    }
                }

                // If we still have a generic message and have status info, add it
                if (errorMessage === "Failed to delete banner" && error.status) {
                    errorMessage = `Failed to delete banner (HTTP ${error.status})`;
                }

                setMessage({ message: errorMessage, type: "error" });
            } finally {
                setIsLoading(false);
            }
        }
    };

    return (
        <div className="main-root-area">
            <div className="main-container options-page">
                <Header
                    onLoginClick={() => setShowLogin(true)}
                    isLoginPage={showLogin}
                />

                {!token && (
                    <div className="sync-warning">
                        <div className="sync-warning-icon-container">
                            <AlertTriangle size={30} style={{ color: '#f57c00' }} />
                        </div>
                        <div className="sync-warning-content">
                            <h3 className="sync-warning-title">
                                Sign In to Unlock Cloud Sync & Premium Features
                            </h3>
                            <div className="sync-warning-text">
                                <div className="sync-warning-text-intro">Your blocked websites are currently stored locally on
                                    this device.
                                </div>
                                <div className="sync-warning-features">
                                    <div>
                                        <div>✨ Sync across all your devices</div>
                                        <div>🔒 Access premium features</div>
                                        <div>☁️ Secure cloud backup</div>
                                    </div>
                                    <div>
                                        <div>🎨 Use custom banner</div>
                                        <div>🗑️ Manage cloud-stored websites</div>
                                    </div>
                                </div>
                            </div>
                            <CustomButton
                                onClick={() => setShowLogin(true)}
                                groupIcon={<LogIn className="input-icon" size={15} />}
                                className="sync-warning-button"
                            >
                                Sign In Now
                            </CustomButton>
                        </div>
                    </div>
                )}

                <BlockedWebsitesList
                    setEditingUrl={setEditingUrl}
                    setIsBlockModalOpen={setIsBlockModalOpen}
                    allBlockUrls={allBlockUrls}
                    deleteUrl={handleDeleteClick}
                    deleteBannerImg={deleteBannerImg}
                    isLoggedIn={!!token}
                    isLoading={isLoading}
                    onAddClick={() => setIsAddModalOpen(true)}
                    refreshBlockedUrls={fetchData}
                />

                <form className="form" id="editBlockForm" onSubmit={editForm.handleSubmit}>
                    <CustomModal
                        isLoading={isLoading}
                        isOpen={isBlockModalOpen}
                        onClose={() => {
                            setIsBlockModalOpen(false);
                            setEditingUrl(null);
                        }}
                        title="Update Website"
                        primaryButtonText="Update"
                        submitBtnFullWidth={false}
                    >
                        <div className="form-container">
                            <div className="form-card">
                                <div className="card-content">
                                    <div className="form">
                                        <InputField
                                            placeholder="Enter Website URL"
                                            type="text"
                                            inputName="activeTabLink"
                                            label="Website URL"
                                            value={editForm.values.activeTabLink}
                                            onchangeCallback={editForm.handleChange}
                                            onBlur={editForm.handleBlur}
                                            inputClassName={editForm.touched.activeTabLink && editForm.errors.activeTabLink ? " is-invalid" : ""}
                                            requiredMessage={editForm.touched.activeTabLink && editForm.errors.activeTabLink}
                                            requiredMessageLabel={editForm.touched.activeTabLink || editForm.isSubmitting ? editForm.errors.activeTabLink : ""}
                                        />
                                        <InputField
                                            placeholder="Enter Redirect URL"
                                            type="text"
                                            inputName="redirectUrl"
                                            label="Redirect URL"
                                            value={editForm.values.redirectUrl}
                                            onchangeCallback={editForm.handleChange}
                                            onBlur={editForm.handleBlur}
                                            inputClassName={editForm.touched.redirectUrl && editForm.errors.redirectUrl ? " is-invalid" : ""}
                                            requiredMessage={editForm.touched.redirectUrl && editForm.errors.redirectUrl}
                                            requiredMessageLabel={editForm.touched.redirectUrl || editForm.isSubmitting ? editForm.errors.redirectUrl : ""}
                                        />

                                        <select
                                            className="form-input"
                                            name="is_temporary"
                                            value={editForm.values.is_temporary || "true"}
                                            onChange={(e) => {
                                                editForm.handleChange(e);
                                                // Set showDefaultTime based on selection (false = Default)
                                                setShowDefaultTime(e.target.value === "false");
                                            }}
                                        >
                                            <option value="true">Temporary</option>
                                            <option value="false">Default</option>
                                        </select>

                                        {!showDefaultTime ? (
                                            <>
                                                <div className="form-group">
                                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                                                        <label className="form-label">
                                                            Temporary Time ({editingUrl?.used_time || 0} min used)
                                                        </label>
                                                        <button
                                                            type="button"
                                                            disabled={isLoading}
                                                            onClick={() => {
                                                                editForm.setFieldValue('minutesToUnblock', '0');
                                                                setTimeout(() => {
                                                                    editForm.submitForm();
                                                                }, 100);
                                                            }}
                                                            style={{
                                                                background: isLoading ? '#ccc' : '#ff9800',
                                                                color: 'white',
                                                                border: 'none',
                                                                borderRadius: '4px',
                                                                padding: '4px 8px',
                                                                fontSize: '12px',
                                                                cursor: isLoading ? 'not-allowed' : 'pointer',
                                                                fontWeight: '500',
                                                                opacity: isLoading ? 0.6 : 1
                                                            }}
                                                            onMouseOver={(e) => {
                                                                if (!isLoading) e.target.style.background = '#f57c00';
                                                            }}
                                                            onMouseOut={(e) => {
                                                                if (!isLoading) e.target.style.background = '#ff9800';
                                                            }}
                                                        >
                                                            {isLoading ? 'Blocking...' : 'Block Now'}
                                                        </button>
                                                    </div>
                                                    <input
                                                        type="text"
                                                        name="minutesToUnblock"
                                                        className="form-input"
                                                        placeholder="Temporary Time"
                                                        value={editForm.values.minutesToUnblock}
                                                        onChange={(e) => {
                                                            const value = e.target.value;
                                                            // Only allow empty string or whole numbers (no decimals)
                                                            if (value === '' || (/^\d+$/.test(value) && parseInt(value) >= 0)) {
                                                                editForm.handleChange(e);
                                                            }
                                                        }}
                                                        onBlur={editForm.handleBlur}
                                                    />
                                                    {editForm.values.minutesToUnblock === '0' && (
                                                        <span className="error-message" style={{ color: '#ff9800', marginTop: '4px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                                                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                                                <circle cx="12" cy="12" r="10"></circle>
                                                                <line x1="12" y1="8" x2="12" y2="12"></line>
                                                                <line x1="12" y1="16" x2="12.01" y2="16"></line>
                                                            </svg>
                                                            This website will be blocked immediately
                                                        </span>
                                                    )}
                                                </div>
                                            </>
                                        ) : (
                                            <div className="form-group">
                                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                                                    <label className="form-label">
                                                        Default Time ({editingUrl?.used_time || 0} min used)
                                                    </label>
                                                    <button
                                                        type="button"
                                                        disabled={isLoading}
                                                        onClick={() => {
                                                            editForm.setFieldValue('default_time', '0');
                                                            setTimeout(() => {
                                                                editForm.submitForm();
                                                            }, 100);
                                                        }}
                                                        style={{
                                                            background: isLoading ? '#ccc' : '#ff9800',
                                                            color: 'white',
                                                            border: 'none',
                                                            borderRadius: '4px',
                                                            padding: '4px 8px',
                                                            fontSize: '12px',
                                                            cursor: isLoading ? 'not-allowed' : 'pointer',
                                                            fontWeight: '500',
                                                            opacity: isLoading ? 0.6 : 1
                                                        }}
                                                        onMouseOver={(e) => {
                                                            if (!isLoading) e.target.style.background = '#f57c00';
                                                        }}
                                                        onMouseOut={(e) => {
                                                            if (!isLoading) e.target.style.background = '#ff9800';
                                                        }}
                                                    >
                                                        {isLoading ? 'Blocking...' : 'Block Now'}
                                                    </button>
                                                </div>
                                                <input
                                                    type="text"
                                                    name="default_time"
                                                    className="form-input"
                                                    placeholder="Default Time"
                                                    value={editForm.values.default_time}
                                                    onChange={(e) => {
                                                        const value = e.target.value;
                                                        // Only allow empty string or whole numbers (no decimals)
                                                        if (value === '' || (/^\d+$/.test(value) && parseInt(value) >= 0)) {
                                                            editForm.handleChange(e);
                                                        }
                                                    }}
                                                    onBlur={editForm.handleBlur}
                                                />
                                                {editForm.values.default_time === '0' && (
                                                    <span className="error-message" style={{ color: '#ff9800', marginTop: '4px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                                                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                                            <circle cx="12" cy="12" r="10"></circle>
                                                            <line x1="12" y1="8" x2="12" y2="12"></line>
                                                            <line x1="12" y1="16" x2="12.01" y2="16"></line>
                                                        </svg>
                                                        This website will be blocked immediately
                                                    </span>
                                                )}
                                            </div>
                                        )}

                                        <InputField
                                            placeholder="Message"
                                            type="text"
                                            inputName="message"
                                            label="Message"
                                            value={editForm.values.message}
                                            onchangeCallback={editForm.handleChange}
                                            onBlur={editForm.handleBlur}
                                            inputClassName={editForm.touched.message && editForm.errors.message ? " is-invalid" : ""}
                                            requiredMessage={editForm.touched.message && editForm.errors.message}
                                            requiredMessageLabel={editForm.touched.message || editForm.isSubmitting ? editForm.errors.message : ""}
                                        />

                                        <InputField
                                            placeholder="Calender URL"
                                            type="text"
                                            inputName="calender_url"
                                            label="Calender URL"
                                            value={editForm.values.calender_url}
                                            onchangeCallback={editForm.handleChange}
                                            onBlur={editForm.handleBlur}
                                            inputClassName={editForm.touched.calender_url && editForm.errors.calender_url ? " is-invalid" : ""}
                                            requiredMessage={editForm.touched.calender_url && editForm.errors.calender_url}
                                            requiredMessageLabel={editForm.touched.calender_url || editForm.isSubmitting ? editForm.errors.calender_url : ""}
                                            tooltip="Go to Google Calendar then copy the public URL of a calendar from settings"
                                        />



                                        {token && (
                                            <>
                                                <InputField
                                                    placeholder="Upload Image"
                                                    type="file"
                                                    inputName="image"
                                                    label="Upload Image"
                                                    ref={editFileInputRef}
                                                    onchangeCallback={(event) =>
                                                        editForm.setFieldValue("image", event.currentTarget.files[0])
                                                    }
                                                />

                                                {/* Preview for existing image from server */}
                                                {editingUrl?.image && !(editForm.values.image instanceof File) && (
                                                    <div className="image-preview-container">
                                                        <button
                                                            type="button"
                                                            className="image-delete-button"
                                                            onClick={() => {
                                                                if (window.confirm("Are you sure you want to delete this image?")) {
                                                                    // Call API to delete the image - only need to set imageUpdate to false
                                                                    const formData = new FormData();
                                                                    formData.append("imageUpdate", "false");

                                                                    setIsLoading(true);

                                                                    AxiosServices.put(
                                                                        ApiUrlServices.UPDATE_BLOCKED_ITEM(editingUrl.id),
                                                                        formData,
                                                                        true
                                                                    )
                                                                        .then(response => {
                                                                            // setMessage({ message: "Image deleted successfully", type: "success" });
                                                                            // Update the editingUrl to remove the image
                                                                            setEditingUrl({ ...editingUrl, image: "" });
                                                                            // Clear the image field in the form
                                                                            editForm.setFieldValue("image", "");
                                                                            // Clear the file input
                                                                            if (editFileInputRef.current) {
                                                                                editFileInputRef.current.value = "";
                                                                            }
                                                                        })
                                                                        .catch(error => {
                                                                            setMessage({ message: "Failed to delete image", type: "error" });
                                                                            console.error("Image deletion error:", error);
                                                                        })
                                                                        .finally(() => {
                                                                            setIsLoading(false);
                                                                        });
                                                                }
                                                            }}
                                                        >
                                                            <Trash2 size={16} color="#ffffff" />
                                                        </button>
                                                        <img
                                                            src={`${IMAGE_BASE_URL + editingUrl?.image}`}
                                                            alt="Preview"
                                                            className="image-preview"
                                                        />
                                                    </div>
                                                )}

                                                {/* Preview for newly selected image file */}
                                                {editForm.values.image instanceof File && (
                                                    <div className="image-preview-container">
                                                        <button
                                                            type="button"
                                                            className="image-delete-button"
                                                            onClick={() => {
                                                                if (window.confirm("Are you sure you want to remove this image?")) {
                                                                    editForm.setFieldValue("image", "");
                                                                    // Clear the file input
                                                                    if (editFileInputRef.current) {
                                                                        editFileInputRef.current.value = "";
                                                                    }
                                                                }
                                                            }}
                                                        >
                                                            <Trash2 size={16} color="#ffffff" />
                                                        </button>
                                                        <img
                                                            src={URL.createObjectURL(editForm.values.image)}
                                                            alt="Preview"
                                                            className="image-preview"
                                                        />
                                                    </div>
                                                )}
                                            </>
                                        )}
                                    </div>
                                </div>
                            </div>
                        </div>
                    </CustomModal>
                </form>

                {/* Add Website Modal */}
                <CustomModal
                    isLoading={isLoading}
                    isOpen={isAddModalOpen}
                    onClose={() => {
                        setIsAddModalOpen(false);
                        setModalMessage({ type: "", message: "" }); // Clear modal message when closing
                        addForm.resetForm(); // Reset form completely
                    }}
                    title="Add Website"
                    primaryButtonText="Add"
                    handleAction={addForm.handleSubmit}
                    submitBtnFullWidth={false}
                >
                    <div className="form-container">
                        <div className="form-card">
                            <div className="card-content">
                                {modalMessage.message && (
                                    <MessageContainer message={modalMessage} />
                                )}
                                <div className="form">
                                    <InputField
                                        placeholder="Enter Website URL"
                                        type="text"
                                        inputName="activeTabLink"
                                        label="Website URL"
                                        asterisk={true}
                                        value={addForm.values.activeTabLink}
                                        onchangeCallback={addForm.handleChange}
                                        onBlur={addForm.handleBlur}
                                        inputClassName={addForm.touched.activeTabLink && addForm.errors.activeTabLink ? " is-invalid" : ""}
                                        requiredMessage={addForm.touched.activeTabLink && addForm.errors.activeTabLink}
                                        requiredMessageLabel={addForm.touched.activeTabLink || addForm.isSubmitting ? addForm.errors.activeTabLink : ""}
                                    />
                                    <InputField
                                        placeholder="Enter Redirect URL"
                                        type="text"
                                        inputName="redirectUrl"
                                        label="Redirect URL"
                                        value={addForm.values.redirectUrl}
                                        onchangeCallback={addForm.handleChange}
                                    />

                                    <select
                                        className="form-input"
                                        name="is_temporary"
                                        value={addForm.values.is_temporary}
                                        onChange={(e) => {
                                            addForm.handleChange(e);
                                            // When switching to Temporary, sync temporary_time with current minutesToUnblock
                                            if (e.target.value === "true" && addForm.values.minutesToUnblock) {
                                                // Don't update default_time when switching to temporary
                                            }
                                            // When switching to Default, sync temporary_time with default_time
                                            else if (e.target.value === "false" && addForm.values.minutesToUnblock) {
                                                addForm.setFieldValue("default_time", addForm.values.minutesToUnblock);
                                            }
                                        }}
                                    >
                                        <option value="true">Temporary</option>
                                        <option value="false">Default</option>
                                    </select>

                                    <div className="form-group">
                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                                            <label htmlFor="minutesToUnblock" className="form-label">
                                                {addForm.values.is_temporary === "true" ? "Minutes to unblock" : "Default time"} <span className="asterisk">*</span>
                                            </label>
                                            <button
                                                type="button"
                                                disabled={isLoading}
                                                onClick={() => {
                                                    addForm.setFieldValue('minutesToUnblock', '0');
                                                    setTimeout(() => {
                                                        addForm.submitForm();
                                                    }, 100);
                                                }}
                                                style={{
                                                    background: isLoading ? '#ccc' : '#ff9800',
                                                    color: 'white',
                                                    border: 'none',
                                                    borderRadius: '4px',
                                                    padding: '4px 8px',
                                                    fontSize: '12px',
                                                    cursor: isLoading ? 'not-allowed' : 'pointer',
                                                    fontWeight: '500',
                                                    opacity: isLoading ? 0.6 : 1
                                                }}
                                                onMouseOver={(e) => {
                                                    if (!isLoading) e.target.style.background = '#f57c00';
                                                }}
                                                onMouseOut={(e) => {
                                                    if (!isLoading) e.target.style.background = '#ff9800';
                                                }}
                                            >
                                                {isLoading ? 'Blocking...' : 'Block Now'}
                                            </button>
                                        </div>
                                        <div className="input-wrapper" style={{ position: "relative" }}>
                                            <input
                                                type="text"
                                                name="minutesToUnblock"
                                                id="minutesToUnblock"
                                                className={`form-input ${addForm.touched.minutesToUnblock && addForm.errors.minutesToUnblock ? " is-invalid" : ""}`}
                                                placeholder={addForm.values.is_temporary === "true" ? "Enter Time" : "Enter Default Time"}
                                                value={addForm.values.minutesToUnblock}
                                                onChange={(e) => {
                                                    const value = e.target.value;
                                                    // Only allow empty string or whole numbers (no decimals)
                                                    if (value === '' || (/^\d+$/.test(value) && parseInt(value) >= 0)) {
                                                        addForm.handleChange(e);
                                                        const newValue = e.target.value;
                                                        
                                                        if (addForm.values.is_temporary === "true") {
                                                            // When updating temporary time, don't update default_time
                                                        } else {
                                                            // When updating default time, also update temporary_time to match
                                                            addForm.setFieldValue("default_time", newValue);
                                                        }
                                                    }
                                                }}
                                                onBlur={addForm.handleBlur}
                                            />
                                        </div>
                                        {addForm.touched.minutesToUnblock && addForm.errors.minutesToUnblock && (
                                            <span className="error-message" style={{
                                                color: (addForm.errors.minutesToUnblock?.includes('blocked immediately') || addForm.errors.minutesToUnblock?.includes('Time should be greater than used time')) ? '#ff9800' : '#ea484f'
                                            }}>
                                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                                    <circle cx="12" cy="12" r="10"></circle>
                                                    <line x1="12" y1="8" x2="12" y2="12"></line>
                                                    <line x1="12" y1="16" x2="12.01" y2="16"></line>
                                                </svg>
                                                {addForm.errors.minutesToUnblock}
                                            </span>
                                        )}
                                        {!addForm.errors.minutesToUnblock && addForm.values.minutesToUnblock === '0' &&
                                         !addForm.errors.activeTabLink && (
                                            <span className="error-message" style={{ color: '#ff9800', marginTop: '4px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                                    <circle cx="12" cy="12" r="10"></circle>
                                                    <line x1="12" y1="8" x2="12" y2="12"></line>
                                                    <line x1="12" y1="16" x2="12.01" y2="16"></line>
                                                </svg>
                                                This website will be blocked immediately
                                            </span>
                                        )}
                                    </div>

                                    <InputField
                                        placeholder="Enter Message"
                                        type="text"
                                        inputName="message"
                                        label="Message"
                                        value={addForm.values.message}
                                        onchangeCallback={addForm.handleChange}
                                    />

                                    <InputField
                                        placeholder="Enter Calendar URL"
                                        type="text"
                                        inputName="calender_url"
                                        label="Calendar URL"
                                        value={addForm.values.calender_url}
                                        onchangeCallback={addForm.handleChange}
                                        tooltip="Go to Google Calendar then copy the public URL of a calendar from settings"
                                    />

                                    {token && (
                                        <>
                                            <InputField
                                                placeholder="Upload Image"
                                                type="file"
                                                inputName="image"
                                                label="Upload Image"
                                                ref={addFileInputRef}
                                                onchangeCallback={(event) =>
                                                    addForm.setFieldValue("image", event.currentTarget.files[0])
                                                }
                                            />

                                            {addForm.values.image && addForm.values.image instanceof File && (
                                                <div className="image-preview-container">
                                                    <button
                                                        type="button"
                                                        className="image-delete-button"
                                                        onClick={() => {
                                                            if (window.confirm("Are you sure you want to remove this image?")) {
                                                                // Clear the image field in the form
                                                                addForm.setFieldValue("image", "");
                                                                // Clear the file input
                                                                if (addFileInputRef.current) {
                                                                    addFileInputRef.current.value = "";
                                                                }
                                                            }
                                                        }}
                                                    >
                                                        <Trash2 size={16} color="#ffffff" />
                                                    </button>
                                                    <img
                                                        src={URL.createObjectURL(addForm.values.image)}
                                                        alt="Preview"
                                                        className="image-preview"
                                                    />
                                                </div>
                                            )}
                                        </>
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>
                </CustomModal>

                {/* Login Modal */}
                <CustomModal
                    isOpen={showLogin}
                    onClose={() => setShowLogin(false)}
                    title="Sign In to Unlock Cloud Sync"
                    showFooter={false}
                >
                    <Login
                        setMessage={setMessage}
                        onBackToHome={() => setShowLogin(false)}
                    />
                </CustomModal>
            </div>
            <MessageContainer message={message} />
        </div>
    );
};

export default Options;