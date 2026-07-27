import {useFormik} from 'formik';
import {Clock4, ShieldBan} from "lucide-react";
import React, {useEffect, useState} from 'react';
import ApiUrlServices from "../../networks/ApiUrlServices";
import AxiosServices from "../../networks/AxiosService";
import CustomButton from "../common/CustomButton/CustomButton";
import {formatUrl} from "../formatUrl";
import InputField from '../InputField/InputField';

// Generate unique ID for local storage items
const generateUniqueId = () => {
    return 'id_' + Math.random().toString(36).substr(2, 9) + '_' + Date.now();
};

function Home({setMessage}) {
    const [isLoading, setIsLoading] = useState(false);
    const [token, setToken] = useState(localStorage.getItem('access_token'));
    const [blockType, setBlockType] = useState(null);

    const validateHomeForm = (values) => {
        const errors = {};
        if (!values.activeTabLink?.trim()) {
            errors.activeTabLink = "Website Url is required";
        } else if (values.activeTabLink.startsWith('chrome-extension://') ||
            values.activeTabLink.startsWith('moz-extension://') ||
            values.activeTabLink.startsWith('extension://')) {
            errors.activeTabLink = "Extension pages cannot be blocked";
        }

        if (values.defaultTime === '' || values.defaultTime === null || values.defaultTime === undefined) {
            errors.defaultTime = "Minutes to unblock is required";
        } else if (isNaN(values.defaultTime) || parseFloat(values.defaultTime) < 0 || !Number.isInteger(parseFloat(values.defaultTime))) {
            errors.defaultTime = "Please enter a positive number (0, 1, 2, 3...)";
        }

        return errors;
    };

    // Helper function to get warning message for 0 minutes
    const getWarningMessage = (values) => {
        if (values.activeTabLink?.startsWith('chrome-extension://') ||
            values.activeTabLink?.startsWith('moz-extension://') ||
            values.activeTabLink?.startsWith('extension://')) {
            return "";
        }
        if (values.defaultTime === '0') {
            return "This website will be blocked immediately";
        }
        return "";
    };

    const homeSubmitForm = async (values) => {
        setIsLoading(true);

        const userTimezone = Intl.DateTimeFormat().resolvedOptions().timeZone;

        const isInstantBlock = values.defaultTime == 0;

        const formData = {
            block_urls: formatUrl(values.activeTabLink.trim()),
            time: values.defaultTime,
            half_time_notified: "false",
            one_quarter_notified: "false",
            three_quarter_notified: "false",
            visited: isInstantBlock ? "true" : "false",
            message: "",
            redirect_urls: "",
            is_temporary: "false",
            temporary_time: values.defaultTime,
            default_time: values.defaultTime,
            timezone: userTimezone
        };

        console.log("Form Data:", formData);

        if (values.redirectUrl.trim()) {
            formData.redirect_urls = formatUrl(values.redirectUrl.trim());
        }

        if (values.message.trim()) {
            formData.message = values.message;
        }

        if (token) {
            // User is authenticated, use API
            try {
                const response = await AxiosServices.post(ApiUrlServices.ADD_URL, formData);

                if (response.data.code === "SUCCESS") {
                    setMessage({message: 'Url added successfully', type: "success"});

                    // Send message to options page to update instead of reloading
                    chrome.runtime.sendMessage({type: 'URL_BLOCKED_UPDATE'});

                    // Reload all tabs that match the blocked URL if instant block (0 minutes)
                    if (isInstantBlock) {
                        chrome.tabs.query({}, (tabs) => {
                            tabs.forEach(tab => {
                                if (tab.url && tab.url.includes(values.activeTabLink.trim())) {
                                    chrome.tabs.reload(tab.id);
                                }
                            });
                        });
                    }

                    // Add a small delay before resetting the form for smoother transition
                    setTimeout(() => {
                        setIsLoading(false);
                        homeForm.resetForm();
                    }, 300);
                }
            } catch (error) {
                if (error.response?.data?.code === "URL_EXISTS") {
                    setMessage({message: 'You already added this website', type: "error"});
                } else if (error.response?.data?.code === "Subscriptions_Expired") {
                    setMessage({
                        message: 'Subscriptions expired. Click here to upgrade premium', 
                        type: "error",
                        onClick: () => chrome.tabs.create({url: 'https://focusly.pro/#plans'})
                    });
                } else if (error.response?.data?.data?.is_subcription_ended) {
                    setMessage({
                        message: 'You can only block 5 sites for free. Click here to upgrade premium',
                        type: "error",
                        onClick: () => chrome.tabs.create({url: 'https://focusly.pro/#plans'})
                    });
                } else {
                    setMessage({message: 'Something went wrong', type: "error"});
                }
                setIsLoading(false);
            }
        } else {
            // User is not authenticated, use Chrome local storage
            try {
                // First, check if the URL already exists in local storage
                chrome.storage.local.get('blocked_urls', (result) => {
                    const blockedUrls = result.blocked_urls || [];
                    const formattedUrl = formatUrl(values.activeTabLink.trim());
                    const urlExists = blockedUrls.some(item =>
                        item.block_urls === formattedUrl
                    );

                    if (urlExists) {
                        setMessage({message: 'Url already exists in block list.', type: "error"});
                        setIsLoading(false);
                        return;
                    }

                    // Generate a unique ID for the new entry
                    formData.id = generateUniqueId();
                    formData.block_urls = formattedUrl;
                    formData.created_at = new Date().toISOString();
                    formData.source = 'local';
                    formData.timezone = userTimezone;
                    
                    // For non-authenticated users, set both temporary_time and default_time
                    // This ensures proper sync when user logs in later
                    formData.temporary_time = formData.default_time;
                    formData.default_time = formData.default_time;
                    formData.minutes_to_unblock = formData.default_time;
                    // Set time limit to the actual time value instead of 0
                    formData.time = formData.default_time;
                    formData.today_limit = isInstantBlock ? "0" : formData.default_time;

                    // Add the new URL to the list
                    const updatedBlockedUrls = [...blockedUrls, formData];

                    // Save the updated list back to storage
                    chrome.storage.local.set({'blocked_urls': updatedBlockedUrls}, () => {
                        setMessage({message: 'Url added successfully', type: "success"});

                        // Send message to options page to update instead of reloading
                        chrome.runtime.sendMessage({type: 'URL_BLOCKED_UPDATE'});
                        
                        // Also send a specific message for local storage updates
                        chrome.runtime.sendMessage({type: 'LOCAL_URL_ADDED', url: formData.block_urls});
                        
                        // Force refresh any open options page tabs
                        chrome.tabs.query({url: chrome.runtime.getURL('options.html')}, (optionsTabs) => {
                            optionsTabs.forEach(tab => {
                                chrome.tabs.reload(tab.id);
                            });
                        });

                        // Reload all tabs that match the blocked URL if instant block (0 minutes)
                        if (isInstantBlock) {
                            chrome.tabs.query({}, (tabs) => {
                                tabs.forEach(tab => {
                                    if (tab.url && tab.url.includes(formData.block_urls)) {
                                        chrome.tabs.reload(tab.id);
                                    }
                                });
                            });
                        }

                        // Add a small delay before resetting the form for smoother transition
                        setTimeout(() => {
                            setIsLoading(false);
                            homeForm.resetForm();
                        }, 300);
                    });
                });
            } catch (error) {
                console.error("Error adding URL to local storage:", error);
                setMessage({message: 'Something went wrong', type: "error"});
                setIsLoading(false);
            }
        }
    };

    const homeForm = useFormik({
        initialValues: {
            activeTabLink: "",
            redirectUrl: "",
            defaultTime: "",
            message: "",
        },
        validateOnChange: true,
        validateOnBlur: true,
        validate: validateHomeForm,
        onSubmit: homeSubmitForm,
    });

    useEffect(() => {
        chrome.tabs.query({active: true, currentWindow: true}, (tabs) => {
            if (tabs[0]) {
                homeForm.setFieldValue('activeTabLink', tabs[0].url);
            }
        });
    }, []);

    return (
        <div className="form-container">
            <div className="form-card">
                <div className="card-header">
                    <h2 className="card-title">Experience a Productivity</h2>
                </div>
                <div className="card-content">
                    <form className="form" id="experienceForm" onSubmit={homeForm.handleSubmit}>
                        <InputField
                            placeholder="Enter Website Url"
                            type="text"
                            inputName="activeTabLink"
                            label="Enter Website Url"
                            asterisk={true}
                            onBlur={homeForm.handleBlur}
                            value={homeForm.values.activeTabLink}
                            onchangeCallback={homeForm.handleChange}
                            inputClassName={homeForm.touched.activeTabLink && homeForm.errors.activeTabLink ? " is-invalid" : ""}
                            requiredMessage={homeForm.touched.activeTabLink && homeForm.errors.activeTabLink}
                            requiredMessageLabel={homeForm.touched.activeTabLink || homeForm.isSubmitting ? homeForm.errors.activeTabLink : ""}
                        />
                        <InputField
                            placeholder="Enter Redirect Website Url"
                            type="text"
                            inputName="redirectUrl"
                            label="Enter Redirect Website Url"
                            asterisk={false}
                            onBlur={homeForm.handleBlur}
                            value={homeForm.values.redirectUrl}
                            onchangeCallback={homeForm.handleChange}
                            inputClassName={homeForm.touched.redirectUrl && homeForm.errors.redirectUrl ? " is-invalid" : ""}
                            requiredMessage={homeForm.touched.redirectUrl && homeForm.errors.redirectUrl}
                            requiredMessageLabel={homeForm.touched.redirectUrl || homeForm.isSubmitting ? homeForm.errors.redirectUrl : ""}
                        />

                        <InputField
                            placeholder="Enter Minutes To Unblock"
                            type="text"
                            inputName="defaultTime"
                            label="Enter Minutes To Unblock"
                            asterisk={true}
                            onBlur={homeForm.handleBlur}
                            value={homeForm.values.defaultTime}
                            onchangeCallback={(e) => {
                                const value = e.target.value;
                                // Only allow empty string or whole numbers (no decimals)
                                if (value === '' || (/^\d+$/.test(value) && parseInt(value) >= 0)) {
                                    homeForm.handleChange(e);
                                }
                            }}
                            inputClassName={homeForm.touched.defaultTime && homeForm.errors.defaultTime ? " is-invalid" : ""}
                            requiredMessage={homeForm.touched.defaultTime && homeForm.errors.defaultTime}
                            requiredMessageLabel={homeForm.touched.defaultTime || homeForm.isSubmitting ? homeForm.errors.defaultTime : ""}
                            warningMessage={getWarningMessage(homeForm.values)}
                        />

                        <InputField
                            placeholder="Enter Message"
                            type="text"
                            inputName="message"
                            label="Enter Message"
                            asterisk={false}
                            onBlur={homeForm.handleBlur}
                            value={homeForm.values.message}
                            onchangeCallback={homeForm.handleChange}
                            inputClassName={homeForm.touched.message && homeForm.errors.message ? " is-invalid" : ""}
                            requiredMessage={homeForm.touched.message && homeForm.errors.message}
                            requiredMessageLabel={homeForm.touched.message || homeForm.isSubmitting ? homeForm.errors.message : ""}
                        />
                        <div className="button-group">
                            <CustomButton
                                className="danger-button"
                                disabled={isLoading}
                                isLoading={isLoading && blockType === 'instant'}
                                groupIcon={<ShieldBan className="input-icon" size={15}/>}
                                fullWidth
                                type="button"
                                onClick={() => {
                                    setBlockType('instant');
                                    homeForm.setFieldValue('defaultTime', '0');
                                    setTimeout(() => {
                                        homeForm.submitForm();
                                    }, 100);
                                }}
                                loadingText="Blocking..."
                                tooltip={isLoading ? '' : 'Instantly blocks the website (ignores time setting)'}
                            >
                                Block Now
                            </CustomButton>
                            <CustomButton
                                className="danger-button bg-white"
                                disabled={isLoading}
                                isLoading={isLoading && blockType === 'schedule'}
                                groupIcon={<Clock4 className="input-icon" size={15}/>}
                                fullWidth
                                type="submit"
                                onClick={() => {
                                    setBlockType('schedule');
                                    homeForm.handleSubmit();
                                }}
                                loadingText="Scheduling..."
                                tooltip={isLoading ? '' : 'Allows access for the specified time, then blocks automatically'}
                            >
                                Schedule Block
                            </CustomButton>
                        </div>
                        <div style={{textAlign: 'center', marginTop: '10px'}}>
                            <a
                                href="#"
                                className="register-link"
                                onClick={(e) => {
                                    e.preventDefault();
                                    chrome.runtime.openOptionsPage();
                                }}
                                style={{textDecoration: 'underline', fontSize: '14px'}}
                            >
                                Manage Blocked Website
                            </a>
                        </div>
                    </form>
                </div>
            </div>
        </div>
    );
}

export default Home;
