import {
    BadgeCheck,
    Calendar,
    Clock,
    Eye,
    Globe,
    Image,
    Lock,
    MessageSquare,
    Pencil,
    Plus,
    Trash2,
    Unlock,
    X,
    Cloud,
    Database,
    Loader2,
    AlertTriangle,
    BarChart3,
    Activity,
    Timer,
    XCircle,
    Zap,
    Crown
} from "lucide-react";
import React, { useState, useEffect } from "react";
import { IMAGE_BASE_URL } from "../../../config/config";
import CustomModal from "../../../components/common/CustomModal/CustomModal";
import ApiUrlServices from "../../../networks/ApiUrlServices";
import AxiosServices from "../../../networks/AxiosService";
import InputField from "../../../components/InputField/InputField";

const BlockedWebsitesList = ({ setEditingUrl, setIsBlockModalOpen, allBlockUrls, deleteUrl, deleteBannerImg, isLoggedIn, isLoading, onAddClick, onAnalyticsClick, refreshBlockedUrls }) => {
    const [selectedWebsite, setSelectedWebsite] = useState(null);
    const [isDetailsModalOpen, setIsDetailsModalOpen] = useState(false);
    const [isAnalyticsModalOpen, setIsAnalyticsModalOpen] = useState(false);
    const [isLoadingAnalyticsData, setIsLoadingAnalyticsData] = useState(false);
    const [analyticsData, setAnalyticsData] = useState(null);
    const [startDate, setStartDate] = useState('');
    const [endDate, setEndDate] = useState('');
    const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
    const [websiteToDelete, setWebsiteToDelete] = useState(null);
    const [isDeleting, setIsDeleting] = useState(false);
    const [isBlockNow, setIsBlockNow] = useState(false);
    const [isLoadingDetails, setIsLoadingDetails] = useState(false);
    const [fetchError, setFetchError] = useState(null);
    const [lastFetchTime, setLastFetchTime] = useState(null);

    // Close modal when escape key is pressed
    useEffect(() => {
        const handleEscapeKey = (e) => {
            if (e.key === 'Escape') {
                if (isDetailsModalOpen) {
                    setIsDetailsModalOpen(false);
                    setSelectedWebsite(null);
                    setIsLoadingDetails(false);
                    setFetchError(null);
                    setLastFetchTime(null);
                }
                if (isDeleteModalOpen && !isDeleting) {
                    setIsDeleteModalOpen(false);
                    setWebsiteToDelete(null);
                }
            }
        };

        document.addEventListener('keydown', handleEscapeKey);
        return () => {
            document.removeEventListener('keydown', handleEscapeKey);
        };
    }, [isDetailsModalOpen, isDeleteModalOpen, isDeleting, isLoadingDetails]);

    // Function to determine if delete button should be disabled
    const isDeleteDisabled = (website) => {
        return !isLoggedIn && (website.source === 'api' || website.source === 'synced');
    };

    // Function to get delete button tooltip
    const getDeleteTooltip = (website) => {
        if (!isLoggedIn && (website.source === 'api' || website.source === 'synced')) {
            return "You must be logged in to delete cloud-stored websites";
        }
        return "Delete this website";
    };

    // Function to fetch latest data for a specific website
    const fetchLatestWebsiteData = async (website) => {
        setIsLoadingDetails(true);
        setFetchError(null);
        try {
            // Trigger a refresh of the blocked URLs list to get latest sync status
            if (refreshBlockedUrls) {
                await refreshBlockedUrls();
            }
            
            const token = localStorage.getItem('access_token');
            
            if (token && (website.source === 'api' || website.source === 'synced')) {
                // Fetch from API for cloud-stored websites
                const response = await AxiosServices.get(ApiUrlServices.GET_URL_LIST);
                const allUrls = response.data.data.urls || [];
                const latestData = allUrls.find(url => url.id === website.id);
                
                if (latestData) {
                    // Preserve the source from the refreshed list
                    setSelectedWebsite({ ...latestData, source: website.source });
                    setLastFetchTime(new Date());
                } else {
                    setSelectedWebsite(website);
                    setLastFetchTime(new Date());
                }
            } else {
                // For local websites, get from chrome storage
                chrome.storage.local.get('blocked_urls', (result) => {
                    const blockedUrls = result.blocked_urls || [];
                    const latestData = blockedUrls.find(url => url.id === website.id);
                    
                    if (latestData) {
                        setSelectedWebsite({ ...latestData, source: latestData.source || 'local' });
                        setLastFetchTime(new Date());
                    } else {
                        setSelectedWebsite({ ...website, source: 'local' });
                        setLastFetchTime(new Date());
                    }
                });
            }
        } catch (error) {
            console.error('Error fetching latest website data:', error);
            setFetchError(error.message || 'Failed to fetch latest data');
            setSelectedWebsite(website);
            setLastFetchTime(new Date());
        } finally {
            setIsLoadingDetails(false);
        }
    };

    // Function to handle delete button click
    const handleDeleteClick = (website) => {
        if (isDeleteDisabled(website)) {
            return;
        }
        setWebsiteToDelete(website);
        setIsDeleteModalOpen(true);
    };

    // Function to handle actual deletion
    const handleConfirmDelete = async () => {
        if (!websiteToDelete) return;

        setIsDeleting(true);
        try {
            await deleteUrl(websiteToDelete.id);
            setIsDeleteModalOpen(false);
            setWebsiteToDelete(null);
        } catch (error) {
            console.error("Error during deletion:", error);
        } finally {
            setIsDeleting(false);
        }
    };

    // Function to get source badge text and style
    const getSourceBadge = (website) => {
        if (website.source === 'api') {
            return {
                text: 'Cloud',
                icon: <Cloud size={14} />,
                style: {
                    backgroundColor: '#039be5',
                    border: '1px solid #0288d1',
                },
                tooltip: "This website is stored in the cloud"
            };
        } else if (website.source === 'synced') {
            return {
                text: 'Synced',
                icon: <Cloud size={14} />,
                style: {
                    backgroundColor: '#7b1fa2',
                    border: '1px solid #6a1b9a',
                },
                tooltip: "This website is synced between cloud and local storage"
            };
        } else {
            return {
                text: 'Local',
                icon: <Database size={14} />,
                style: {
                    backgroundColor: '#546e7a',
                    border: '1px solid #455a64',
                },
                tooltip: "This website is stored only on this device"
            };
        }
    };

    const getAnalyticsData = async (params = {}) => {
        try {
            setIsLoadingAnalyticsData(true)
            const queryParams = new URLSearchParams();
            if (params.start_date) queryParams.append('start_date', params.start_date);
            if (params.end_date) queryParams.append('end_date', params.end_date);
            if (params.period) queryParams.append('period', params.period);
            
            const url = `${ApiUrlServices.DASHBOARD_ANALYTICS}${queryParams.toString() ? '?' + queryParams.toString() : ''}`;
            const response = await AxiosServices.get(url);
            if (response.data && response.data.data) {
                const analyticsData = response.data.data;
                setAnalyticsData(analyticsData)
            }
        } catch (e) {
            setAnalyticsData(null)
        } finally {
            setIsLoadingAnalyticsData(false)
        }
    }

    const InternalLoader = ({text1="Loading latest data...", text2="Fetching real-time information"}) => {
        return <div className="loading-container" style={{padding: '40px', textAlign: 'center'}}>
            <div style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: '16px'
            }}>
                <Loader2 className="loader-icon" size={32} style={{color: '#4fc3f7'}}/>
                <div style={{
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    gap: '4px'
                }}>
                    <span style={{fontSize: '16px', fontWeight: '500'}}>{text1}</span>
                    <span style={{
                        fontSize: '14px',
                        color: '#888',
                        opacity: 0.8
                    }}>{text2}</span>
                </div>
            </div>
        </div>
    }

    return (
        <div className="websites-container">
            <div className="websites-list">
                <div className="website-card">
                    <div className="website-list-title">
                        <div className="website-list-title-left">
                            <Globe size={24} />
                            Blocked Websites
                        </div>
                        <div className="add-website-button-main">
                            {isLoggedIn && (
                                <button onClick={()=> {
                                    setIsAnalyticsModalOpen(true);
                                    setStartDate('');
                                    setEndDate('');
                                    getAnalyticsData({ period: 7 })
                                }} className="add-website-button">
                                    <Eye size={20}/>
                                    View Analytics
                                </button>
                            )}
                            <button onClick={onAddClick} className="add-website-button">
                                <Plus size={20}/>
                                Add Website
                            </button>
                        </div>
                    </div>
                    
                    {isLoading ? (
                        <div className="loading-container">
                            <Loader2 className="loader-icon" size={32} />
                            <span>Loading websites...</span>
                        </div>
                    ) : (
                        <>
                            {allBlockUrls.length > 0 ? (
                                allBlockUrls
                                    .filter((website, index, self) => 
                                        index === self.findIndex(w => w.block_urls === website.block_urls)
                                    )
                                    .map((website, index) => {
                                    const sourceBadge = getSourceBadge(website);
                                    return (
                                        <div className="website-item" key={`${website.block_urls}-${website.id || index}`}>
                                            <div className="website-card-header">
                                                <div className="website-url">
                                                    <span className="url-text">
                                                        <a href={website.block_urls} target="_blank" title={website.block_urls}>
                                                            {website.block_urls}
                                                        </a>
                                                    </span>
                                                    <div className="url-info">
                                                        <div className="url-info-badge"
                                                            style={{
                                                                backgroundColor: sourceBadge.style.backgroundColor,
                                                                border: sourceBadge.style.border
                                                            }}
                                                            title={sourceBadge.tooltip}
                                                        >
                                                            {sourceBadge.icon}
                                                            <span style={{ marginLeft: '4px' }}>{sourceBadge.text}</span>
                                                        </div>

                                                        <div className="url-info-badge" style={{
                                                            backgroundColor: website.visited === "true" || website.visited === true ? '#ffd9d9' : '#e8f5e9',
                                                            border: website.visited === "true" || website.visited === true ? '1px solid #ffcdd2' : '1px solid #c8e6c9'
                                                        }}>
                                                            {website.visited === "true" || website.visited === true ? (
                                                                <Lock className="info-icon" style={{ color: '#d32f2f' }} size={12} />
                                                            ) : (
                                                                <Unlock className="info-icon" style={{ color: '#2e7d32' }} size={12} />
                                                            )}
                                                            <span className="url-info-badge-dtx" style={{
                                                                color: website.visited === "true" || website.visited === true ? '#d32f2f' : '#2e7d32'
                                                            }}>
                                                                {website.visited === "true" || website.visited === true ? 'Blocked' : 'Active'}
                                                            </span>
                                                        </div>
                                                        
                                                        {website.visited !== "true" && website.visited !== true && (
                                                            <button
                                                                className="block-now-button"
                                                                onClick={async () => {
                                                                    setIsBlockNow(true)
                                                                    const token = localStorage.getItem('access_token');
                                                                    const userTimezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
                                                                    
                                                                    if (token) {
                                                                        // Update via API using FormData like the modal
                                                                        try {
                                                                            const formData = new FormData();
                                                                            formData.append("block_urls", website.block_urls);
                                                                            formData.append("redirect_urls", website.redirect_urls || "");
                                                                            formData.append("message", website.message || "");
                                                                            formData.append("calender_url", website.calender_url || "");
                                                                            formData.append("is_temporary", String(website.is_temporary || "true"));
                                                                            formData.append("timezone", userTimezone);
                                                                            formData.append("visited", "true");
                                                                            formData.append("time", "0");
                                                                            formData.append("temporary_time", "0");
                                                                            formData.append("default_time", "0");
                                                                            formData.append("today_limit", "0");
                                                                            
                                                                            const response = await AxiosServices.put(
                                                                                ApiUrlServices.UPDATE_BLOCKED_ITEM(website.id),
                                                                                formData,
                                                                                true
                                                                            );
                                                                            
                                                                            chrome.runtime.sendMessage({ type: 'URL_BLOCKED_UPDATE' });
                                                                            // Refresh the blocked websites list
                                                                            if (refreshBlockedUrls) {
                                                                                refreshBlockedUrls();
                                                                            }
                                                                            // Reload all tabs that match the blocked URL
                                                                            chrome.tabs.query({}, (tabs) => {
                                                                                tabs.forEach(tab => {
                                                                                    if (tab.url && tab.url.includes(website.block_urls)) {
                                                                                        chrome.tabs.reload(tab.id);
                                                                                    }
                                                                                });
                                                                            });
                                                                        } catch (error) {
                                                                            console.error('Error blocking URL:', error);
                                                                        }
                                                                    } else {
                                                                        // Update local storage
                                                                        chrome.storage.local.get('blocked_urls', (result) => {
                                                                            const blockedUrls = result.blocked_urls || [];
                                                                            const updatedUrls = blockedUrls.map(url => 
                                                                                url.id === website.id ? {
                                                                                    ...url,
                                                                                    visited: "true",
                                                                                    time: "0",
                                                                                    temporary_time: "0",
                                                                                    default_time: "0",
                                                                                    today_limit: "0",
                                                                                    timezone: userTimezone
                                                                                } : url
                                                                            );
                                                                            
                                                                            chrome.storage.local.set({ 'blocked_urls': updatedUrls }, () => {
                                                                                chrome.runtime.sendMessage({ type: 'URL_BLOCKED_UPDATE' });
                                                                                // Refresh the blocked websites list
                                                                                if (refreshBlockedUrls) {
                                                                                    refreshBlockedUrls();
                                                                                }
                                                                                // Reload all tabs that match the blocked URL
                                                                                chrome.tabs.query({}, (tabs) => {
                                                                                    tabs.forEach(tab => {
                                                                                        if (tab.url && tab.url.includes(website.block_urls)) {
                                                                                            chrome.tabs.reload(tab.id);
                                                                                        }
                                                                                    });
                                                                                });
                                                                            });
                                                                        });
                                                                    }
                                                                    setIsBlockNow(false)
                                                                }}
                                                                title="Block this website now"
                                                            >
                                                                {
                                                                    isBlockNow ? <Loader2 className="loader-icon" size={12}/> : <Lock size={12} />
                                                                }
                                                                Block Now
                                                            </button>
                                                        )}
                                                    </div>
                                                </div>
                                                <div className="action-buttons">
                                                    <button
                                                        className="icon-button view-button"
                                                        onClick={async () => {
                                                            setSelectedWebsite(website);
                                                            setIsDetailsModalOpen(true);
                                                            await fetchLatestWebsiteData(website);
                                                        }}
                                                        aria-label="View Details"
                                                    >
                                                        <Eye size={18} />
                                                    </button>
                                                    <button
                                                        className="icon-button edit-button"
                                                        onClick={() => {
                                                            setIsBlockModalOpen(true);
                                                            setEditingUrl(website);
                                                        }}
                                                        aria-label="Edit URL"
                                                    >
                                                        <Pencil size={18} />
                                                    </button>
                                                    <button
                                                        className={`icon-button delete-button ${isDeleteDisabled(website) ? 'disabled' : ''}`}
                                                        onClick={() => handleDeleteClick(website)}
                                                        disabled={isDeleteDisabled(website)}
                                                        title={getDeleteTooltip(website)}
                                                        aria-label="Delete URL"
                                                    >
                                                        <Trash2 size={18} />
                                                    </button>
                                                </div>
                                            </div>
                                        </div>
                                    );
                                })
                            ) : (
                                <h1 className="no_block">No websites are blocked yet.</h1>
                            )}
                        </>
                    )}
                </div>
            </div>

            {/* Details Modal */}
            {isDetailsModalOpen && selectedWebsite && (
                <div className="modal-overlay">
                    <div className="modal-content">
                        <div className="modal-header">
                            <h2 className="modal-title">
                                Website Details
                                {!isLoadingDetails && selectedWebsite && lastFetchTime && (
                                    <span className="fresh-data-badge" style={{
                                        marginLeft: '10px',
                                        padding: '2px 8px',
                                        backgroundColor: '#4caf50',
                                        color: 'white',
                                        borderRadius: '12px',
                                        fontSize: '12px',
                                        fontWeight: '500'
                                    }} title={`Last updated: ${lastFetchTime.toLocaleTimeString()}`}>
                                        Latest Data
                                    </span>
                                )}
                            </h2>
                            <button
                                className="close-button extra-margin-bottom"
                                onClick={() => {
                                    setIsDetailsModalOpen(false);
                                    setSelectedWebsite(null);
                                    setIsLoadingDetails(false);
                                    setFetchError(null);
                                    setLastFetchTime(null);
                                }}
                            >
                                <X size={20} />
                            </button>
                        </div>

                        <div className="modal-body">
                            {isLoadingDetails ? (
                                <InternalLoader/>
                            ) : (
                            <>
                            <div className="website-url-display">
                                <div className="url-display-content">
                                    <Globe size={16} style={{ flexShrink: 0, color: '#fff' }} />
                                    <a
                                        href={selectedWebsite.block_urls}
                                        target="_blank"
                                        className="url-display-link"
                                    >
                                        {selectedWebsite.block_urls}
                                    </a>
                                </div>

                                <div className="source-badge-container">
                                    <span className="source-label">Storage:</span>
                                    <div className="source-badge" style={{
                                        backgroundColor: getSourceBadge(selectedWebsite).style.backgroundColor
                                    }}>
                                        {getSourceBadge(selectedWebsite).icon}
                                        <span>{getSourceBadge(selectedWebsite).text}</span>
                                    </div>
                                </div>
                            </div>

                            <div className="website-details">
                                <div className="details-container">
                                    <div className="info-section">
                                        <div className="info-item">
                                            <Clock className="info-icon" style={{ color: '#4fc3f7' }} />
                                            <span className="info-label">Time Limit:</span>
                                            <span className="info-value">{selectedWebsite.is_temporary === "true" || selectedWebsite.is_temporary === true ? (selectedWebsite.temporary_time || 0) : (selectedWebsite.default_time || 0)} {(selectedWebsite.is_temporary === "true" || selectedWebsite.is_temporary === true ? (selectedWebsite.temporary_time || 0) : (selectedWebsite.default_time || 0)) > 1 ? "Minutes" : "Minute"}</span>
                                        </div>

                                        <div className="info-item">
                                            <Clock className="info-icon" style={{ color: '#2e7d32' }} />
                                            <span className="info-label">Default Time:</span>
                                            <span className="info-value">{selectedWebsite.default_time || 0} {(selectedWebsite.default_time || 0) !== 1 ? "Minutes" : "Minute"}</span>
                                        </div>

                                      
                                            <div className="info-item">
                                                <Clock className="info-icon" style={{ color: '#ff9800' }} />
                                                <span className="info-label">Temporary Time:</span>
                                                <span className="info-value">{selectedWebsite.temporary_time} {selectedWebsite.temporary_time > 1 ? "Minutes" : "Minute"}</span>
                                            </div>
                                        

                                        <div className="info-item">
                                            <Clock className="info-icon" style={{ color: '#4fc3f7' }} />
                                            <span className="info-label">Time Used Today:</span>
                                            <span className="info-value">
                                            {selectedWebsite.used_time || 0} {(selectedWebsite.used_time || 0) !== 1 ? "Minutes" : "Minute"}
                                            </span>
                                        </div>

                                        <div className="info-item">
                                            {selectedWebsite.visited === "true" || selectedWebsite.visited === true ? (
                                                <Lock className="info-icon" style={{ color: '#ff5252' }} />
                                            ) : (
                                                <Unlock className="info-icon" style={{ color: '#66bb6a' }} />
                                            )}
                                            <span className="info-label">Status:</span>
                                            <span className="info-value" style={{
                                                color: selectedWebsite.visited === "true" || selectedWebsite.visited === true ? '#ff5252' : '#66bb6a',
                                                fontWeight: '500'
                                            }}>
                                                {selectedWebsite.visited === "true" || selectedWebsite.visited === true ? "Blocked" : "Active"}
                                            </span>
                                        </div>

                                        <div className="info-item">
                                            <BadgeCheck className="info-icon" style={{ color: '#bb86fc' }} />
                                            <span className="info-label">Premium:</span>
                                            <span className="info-value">{selectedWebsite.is_active ? "Yes" : "No"}</span>
                                        </div>

                                        <div className="info-item">
                                            <MessageSquare className="info-icon" style={{ color: '#ffab40' }} />
                                            <span className="info-label">Message:</span>
                                            <span className="info-value" title={selectedWebsite.message}>
                                                {selectedWebsite.message || "N/A"}
                                            </span>
                                        </div>

                                        <div className="info-item">
                                            <Calendar className="info-icon" style={{ color: '#ff7043' }} />
                                            <span className="info-label">Calendar:</span>
                                            <span className="info-value">
                                                {selectedWebsite.calender_url ? (
                                                    <a
                                                        target="_blank"
                                                        href={selectedWebsite.calender_url}
                                                        className="info-value-link"
                                                    >
                                                        View
                                                    </a>
                                                ) : (
                                                    "N/A"
                                                )}
                                            </span>
                                        </div>

                                        <div className="info-item full-width">
                                            <Globe className="info-icon" style={{ color: '#4CAF50' }} />
                                            <span className="info-label">Redirect URL:</span>
                                            <span className="info-value">
                                                {selectedWebsite.redirect_urls ? (
                                                    <a
                                                        target="_blank"
                                                        href={selectedWebsite.redirect_urls}
                                                        className="info-value-link"
                                                    >
                                                        {selectedWebsite.redirect_urls}
                                                    </a>
                                                ) : (
                                                    "N/A"
                                                )}
                                            </span>
                                        </div>

                                        {isLoggedIn && (
                                            <div className="info-item full-width align-start">
                                                <Image className="info-icon mt-5" style={{ color: '#64b5f6' }} />
                                                <span className="info-label mt-5">Banner:</span>
                                                <div className="info-value">
                                                    {selectedWebsite.image ? (
                                                        <img
                                                            src={IMAGE_BASE_URL + selectedWebsite.image}
                                                            alt="banner"
                                                            className="banner-image"
                                                        />
                                                    ) : (
                                                        <span className="no-banner">No banner image</span>
                                                    )}
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>
                            
                            
                            {fetchError && !isLoadingDetails && (
                                <div style={{
                                    padding: '16px',
                                    backgroundColor: '#fee2e2',
                                    border: '1px solid #fca5a5',
                                    borderRadius: '8px',
                                    color: '#dc2626',
                                    marginBottom: '16px',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'space-between'
                                }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                        <AlertTriangle size={16} />
                                        <span>{fetchError}</span>
                                    </div>
                                    <button
                                        onClick={() => fetchLatestWebsiteData(selectedWebsite)}
                                        style={{
                                            background: '#dc2626',
                                            color: 'white',
                                            border: 'none',
                                            padding: '4px 8px',
                                            borderRadius: '4px',
                                            fontSize: '12px',
                                            cursor: 'pointer'
                                        }}
                                    >
                                        Retry
                                    </button>
                                </div>
                            )}
                        </>
                    )}
                        </div>

                        <div className="modal-footer">
                            <button
                                className="footer-button secondary"
                                onClick={async () => {
                                    if (selectedWebsite && !isLoadingDetails) {
                                        await fetchLatestWebsiteData(selectedWebsite);
                                    }
                                }}
                                disabled={isLoadingDetails}
                                style={{
                                    marginRight: '10px',
                                    backgroundColor: '#2196f3',
                                    color: 'white',
                                    opacity: isLoadingDetails ? 0.6 : 1,
                                    cursor: isLoadingDetails ? 'not-allowed' : 'pointer'
                                }}
                            >
                                {isLoadingDetails ? (
                                    <>
                                        <Loader2 size={16} style={{ marginRight: '5px', animation: 'spin 1s linear infinite' }} />
                                        Refreshing...
                                    </>
                                ) : (
                                    'Refresh Data'
                                )}
                            </button>
                            <button
                                className="footer-button"
                                onClick={() => {
                                    setIsDetailsModalOpen(false);
                                    setSelectedWebsite(null);
                                    setIsLoadingDetails(false);
                                    setFetchError(null);
                                    setLastFetchTime(null);
                                }}
                            >
                                Close
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Delete Confirmation Modal */}
            <CustomModal
                isOpen={isDeleteModalOpen}
                onClose={() => {
                    if (!isDeleting) {
                        setIsDeleteModalOpen(false);
                        setWebsiteToDelete(null);
                    }
                }}
                title="Delete Website"
                primaryButtonText={isDeleting ? "Deleting..." : "Delete"}
                primaryButtonStyle="danger"
                handleAction={handleConfirmDelete}
                submitBtnFullWidth={false}
                showCloseButton={!isDeleting}
                secondaryButtonText="Cancel"
                isLoading={isDeleting}
            >
                <div className="delete-confirmation-content">
                    <p>Are you sure you want to delete this website? This action cannot be undone.</p>
                    {websiteToDelete && (
                        <div className="website-to-delete-container" style={{
                            backgroundColor: '#303137',
                            border: '#1a1d2d'
                        }}>
                            <div className="website-to-delete">
                                <div className="website-to-delete-icon" style={{
                                    backgroundColor: getSourceBadge(websiteToDelete).style.backgroundColor,
                                    border: getSourceBadge(websiteToDelete).style.border
                                }}>
                                    <Globe size={18} style={{ color: '#ffffff' }} />
                                </div>
                                <div className="website-to-delete-details">
                                    <div className="website-to-delete-url" style={{ color: '#ffffff' }}>
                                        {websiteToDelete.block_urls}
                                    </div>
                                    <div className="website-to-delete-badge" style={{
                                        backgroundColor: getSourceBadge(websiteToDelete).style.backgroundColor,
                                        border: getSourceBadge(websiteToDelete).style.border,
                                        color: '#ffffff'
                                    }}>
                                        {getSourceBadge(websiteToDelete).icon}
                                        <span>{getSourceBadge(websiteToDelete).text}</span>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}
                    {!isLoggedIn && websiteToDelete && (websiteToDelete.source === 'api' || websiteToDelete.source === 'synced') && (
                        <div className="delete-warning">
                            <AlertTriangle size={50} style={{ color: '#f57c00' }} />
                            <div>
                                <div className="delete-warning-title">Important notice</div>
                                <div className="delete-warning-text">
                                    Cloud-stored websites can only be deleted when you're logged in. Deleting locally won't remove them from the cloud.
                                </div>
                            </div>
                        </div>
                    )}
                    {isDeleting && (
                        <div className="deleting-indicator">
                            <Loader2 className="loader-icon" size={20} />
                            <span>Deleting website...</span>
                        </div>
                    )}
                </div>
            </CustomModal>

            {/* View Analytics Modal */}
            <CustomModal
                isOpen={isAnalyticsModalOpen}
                onClose={() => {
                    setIsAnalyticsModalOpen(false);
                    setAnalyticsData(null)
                }}
                title="View Analytics"
                showFooter={false}
                customModalContentClass="analytics-modal-content"
            >
                {isLoadingAnalyticsData ? (
                    <InternalLoader text1="Loading Analytics" text2="Please wait..."/>
                ) : analyticsData ? (
                    <div className="website-details">
                        <div className="analytics-search">
                            <InputField
                                type="date"
                                inputName="startDate"
                                label="Start Date"
                                value={startDate}
                                onchangeCallback={(e) => {
                                    const newStartDate = e.target.value;
                                    setStartDate(newStartDate);
                                    const params = {};
                                    if (newStartDate) params.start_date = newStartDate;
                                    if (endDate) params.end_date = endDate;
                                    if (!newStartDate && !endDate) params.period = 7;
                                    getAnalyticsData(params);
                                }}
                            />
                            <InputField
                                type="date"
                                inputName="endDate"
                                label="End Date"
                                value={endDate}
                                onchangeCallback={(e) => {
                                    const newEndDate = e.target.value;
                                    setEndDate(newEndDate);
                                    const params = {};
                                    if (startDate) params.start_date = startDate;
                                    if (newEndDate) params.end_date = newEndDate;
                                    if (!startDate && !newEndDate) params.period = 7;
                                    getAnalyticsData(params);
                                }}
                            />
                        </div>
                        <div className="details-container">
                            {/* Current Plan Highlight */}
                            <div className="current-plan-highlight">
                                <div className="plan-badge">
                                    <Crown className="plan-icon" style={{color: '#ffd700'}}/>
                                    <span
                                        className="plan-text">Current Plan: {analyticsData.plan_usage?.current_plan || 'FREE'}</span>
                                    <span className="plan-usage">{analyticsData.plan_usage?.usage_percentage || 0}% Used</span>
                                </div>
                            </div>

                            <div className="info-section">
                                {/* Quick Stats */}
                                <div className="info-item">
                                    <Globe className="info-icon" style={{color: '#4fc3f7'}}/>
                                    <span className="info-label">Total URLs:</span>
                                    <span
                                        className="info-value">{analyticsData.quick_stats?.total_urls || 0}</span>
                                </div>

                                <div className="info-item">
                                    <Activity className="info-icon" style={{color: '#2e7d32'}}/>
                                    <span className="info-label">Active URLs:</span>
                                    <span
                                        className="info-value">{analyticsData.quick_stats?.active_urls || 0}</span>
                                </div>

                                <div className="info-item">
                                    <XCircle className="info-icon" style={{color: '#f44336'}}/>
                                    <span className="info-label">Inactive URLs:</span>
                                    <span
                                        className="info-value">{analyticsData.quick_stats?.inactive_urls || 0}</span>
                                </div>

                                <div className="info-item">
                                    <Eye className="info-icon" style={{color: '#9c27b0'}}/>
                                    <span className="info-label">Visited URLs:</span>
                                    <span
                                        className="info-value">{analyticsData.quick_stats?.visited_urls || 0}</span>
                                </div>

                                <div className="info-item">
                                    <Clock className="info-icon" style={{color: '#ff9800'}}/>
                                    <span className="info-label">Total Time:</span>
                                    <span
                                        className="info-value">{analyticsData.quick_stats?.total_time_minutes || 0} Minutes</span>
                                </div>

                                <div className="info-item">
                                    <Timer className="info-icon" style={{color: '#607d8b'}}/>
                                    <span className="info-label">Avg Time/URL:</span>
                                    <span
                                        className="info-value">{analyticsData.quick_stats?.avg_time_per_url || 0} Minutes</span>
                                </div>

                                {/* Plan Usage Details */}
                                <div className="info-item">
                                    <Zap className="info-icon" style={{color: '#ff5722'}}/>
                                    <span className="info-label">URLs Used:</span>
                                    <span className="info-value">
                            {analyticsData.plan_usage?.urls_used || 0}/{analyticsData.plan_usage?.urls_limit === -1 ? 'unlimited' : (analyticsData.plan_usage?.urls_limit || 0)}
                        </span>
                                </div>

                                <div className="info-item">
                                    <BarChart3 className="info-icon" style={{
                                        color: (analyticsData.plan_usage?.usage_percentage || 0) > 80 ? '#f44336' : '#4caf50'
                                    }}/>
                                    <span className="info-label">Usage Progress:</span>
                                    <span
                                        className="info-value">{analyticsData.plan_usage?.usage_percentage || 0}%</span>
                                </div>

                                <div className="info-item">
                                    <Calendar className="info-icon" style={{color: '#3f51b5'}}/>
                                    <span className="info-label">Period:</span>
                                    <span className="info-value">{analyticsData.period || 7}</span>
                                </div>
                            </div>
                        </div>
                    </div>
                ) : (
                    <div>No data available</div>
                )}
                
                <div className="modal-footer-analytics">
                    <button
                        className={`footer-button secondary reset-button ${isLoadingAnalyticsData ? 'disabled' : ''}`}
                        onClick={() => {
                            setStartDate('');
                            setEndDate('');
                            getAnalyticsData({ period: 7 });
                        }}
                        disabled={isLoadingAnalyticsData}
                    >
                        Reset
                    </button>
                    <button
                        className={`footer-button secondary refresh-button ${isLoadingAnalyticsData ? 'disabled' : ''}`}
                        onClick={async () => {
                            if (!isLoadingAnalyticsData) {
                                const params = {};
                                if (startDate) params.start_date = startDate;
                                if (endDate) params.end_date = endDate;
                                if (!startDate && !endDate) params.period = 7;
                                await getAnalyticsData(params);
                            }
                        }}
                        disabled={isLoadingAnalyticsData}
                    >
                        {isLoadingAnalyticsData ? (
                            <>
                                <Loader2 size={16} className="loader-spin" />
                                Refreshing...
                            </>
                        ) : (
                            'Refresh Data'
                        )}
                    </button>
                    <button
                        className="footer-button"
                        onClick={() => {
                            setIsAnalyticsModalOpen(false);
                            setAnalyticsData(null);
                            setStartDate('');
                            setEndDate('');
                        }}
                    >
                        Close
                    </button>
                </div>
            </CustomModal>
           
        </div>
    );
};

export default BlockedWebsitesList;