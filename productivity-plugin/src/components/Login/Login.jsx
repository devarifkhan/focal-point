import { useFormik } from "formik";
import { Loader2, LogIn, ArrowLeft } from "lucide-react";
import React, { useState, useEffect, useRef } from "react";
import { sessionData } from "../../config/sessionKeys";
import ApiUrlServices from "../../networks/ApiUrlServices";
import AxiosServices from "../../networks/AxiosService";
import CustomButton from "../common/CustomButton/CustomButton";
import ForgotPassword from "../ForgotPassword/ForgotPassword";
import InputField from "../InputField/InputField";
import MessageContainer from "../../components/MessageContainer/MessageContainer";
import Register from "../Register/Register";

function Login({ onBackToHome, setMessage }) {
    const [isLoading, setIsLoading] = useState(false);
    const [isRegister, setIsRegister] = useState(false);
    const [isForgotPassword, setIsForgotPassword] = useState(false);
    const [isVerifyLoading, setIsVerifyLoading] = useState(false);
    const [verificationEmail, setVerificationEmail] = useState("");
    const [localMessage, setLocalMessage] = useState({ type: "", message: "" });
    const containerRef = useRef(null);
    
    // Check if this component is being shown in a modal
    const [isInModal, setIsInModal] = useState(false);
    
    useEffect(() => {
        if (containerRef.current) {
            // Check if this component is inside a modal by looking at parent elements
            const checkIfInModal = () => {
                let parent = containerRef.current.parentElement;
                while (parent) {
                    if (parent.className.includes('modal-')) {
                        return true;
                    }
                    parent = parent.parentElement;
                }
                return false;
            };
            
            setIsInModal(checkIfInModal());
        }
    }, []);

    // Display messages only locally, don't propagate to parent
    const displayMessage = (msg) => {
        console.log("Login displayMessage:", msg);
        // Only update local message
        setLocalMessage(msg);
    };

    // Clear messages when component mounts or when switching between forms
    useEffect(() => {
        displayMessage({ type: "", message: "" });
    }, [isRegister, isForgotPassword]);

    // Function to sync local blocked sites to API
    const syncLocalBlockedSitesToApi = async () => {
        try {
            // Get locally blocked sites
            const result = await new Promise((resolve) => {
                chrome.storage.local.get('blocked_urls', resolve);
            });

            const blockedUrls = result.blocked_urls || [];
            console.log('Found blocked URLs to sync:', blockedUrls.length);
            
            // First, fetch all existing URLs from server
            let existingUrls = [];
            try {
                const response = await AxiosServices.get(ApiUrlServices.GET_URL_LIST);
                existingUrls = response.data.data.urls || [];
                console.log('Existing URLs from server:', existingUrls.length);
            } catch (fetchError) {
                console.error('Error fetching existing URLs:', fetchError);
            }

            // Sync each blocked site to the API
            for (const site of blockedUrls) {
                try {
                    console.log('Preparing to sync site:', site.block_urls);
                    
                    // Store the URL without encoding the # character
                    const processedUrl = site.block_urls;
                    
                    // Convert time to integer
                    const timeValue = site.time ? Math.floor(parseFloat(site.time)) : 0;
                    
                    // Get default timezone if not present
                    const defaultTimezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
                    
                    // Prepare data as a JavaScript object with stringified boolean values
                    const siteData = {
                        block_urls: processedUrl,
                        redirect_urls: site.redirect_urls || "",
                        minutes_to_unblock: site.minutes_to_unblock || "0",
                        message: site.message || "",
                        calender_url: site.calender_url || "",
                        is_temporary: String(site.is_temporary === true || site.is_temporary === "true"),
                        visited: String(site.visited === true || site.visited === "true"),
                        half_time_notified: String(site.half_time_notified === true || site.half_time_notified === "true"),
                        one_quarter_notified: String(site.one_quarter_notified === true || site.one_quarter_notified === "true"),
                        three_quarter_notified: String(site.three_quarter_notified === true || site.three_quarter_notified === "true"),
                        time: String(timeValue),
                        // Preserve both default_time and temporary_time from local storage
                        default_time: String(site.default_time || site.minutes_to_unblock || "0"),
                        temporary_time: String(site.temporary_time || site.minutes_to_unblock || "0"),
                        // Preserve today_limit and used_time from local storage
                        today_limit: String(site.today_limit || site.minutes_to_unblock || "0"),
                        used_time: String(site.used_time || site.time || "0"),
                        timezone: site.timezone || defaultTimezone,
                        is_active: "true",
                        edit: "false"
                    };
                    
                    // Check if URL already exists in the server
                    const existingUrl = existingUrls.find(url => url.block_urls === processedUrl);
                    
                    if (existingUrl) {
                        console.log(`URL ${processedUrl} already exists with ID ${existingUrl.id}, updating...`);
                        
                        // Create FormData for update
                        const formData = new FormData();
                        Object.entries(siteData).forEach(([key, value]) => {
                            formData.append(key, value);
                        });
                        
                        // Ensure temporary_time is explicitly set
                        if (!formData.has('temporary_time')) {
                            formData.append('temporary_time', siteData.temporary_time || siteData.default_time || "0");
                        }
                        
                        // Use PUT to update the existing URL with FormData
                        await AxiosServices.put(ApiUrlServices.UPDATE_BLOCKED_ITEM(existingUrl.id), formData, true);
                        console.log(`Successfully updated site: ${processedUrl}`);
                    } else {
                        console.log(`URL ${processedUrl} does not exist, adding as new...`);
                        
                        // Use POST to add the new URL with JSON data
                        await AxiosServices.post(ApiUrlServices.ADD_URL, siteData);
                        console.log(`Successfully added new site: ${processedUrl}`);
                    }

                    // Send message to background script to maintain blocking state
                    try {
                        chrome.runtime.sendMessage({
                            type: "MAINTAIN_BLOCK_STATE",
                            url: site.block_urls,
                            isBlocked: siteData.visited === "true",
                            minutesToUnblock: parseInt(site.minutes_to_unblock || "0", 10),
                            visited: siteData.visited === "true"
                        });
                    } catch (msgError) {
                        console.warn("Failed to send message to background script:", msgError);
                    }
                } catch (error) {
                    // Enhanced error logging
                    console.error("Error syncing site:", site.block_urls);
                    console.error("Error details:", {
                        responseData: error.response?.data,
                        status: error.response?.status,
                        statusText: error.response?.statusText
                    });
                    
                    // Handle URL_EXISTS error - this is not actually an error
                    if (error.response?.data?.code === "URL_EXISTS" || 
                        error.data?.code === "URL_EXISTS" || 
                        (typeof error.message === 'string' && error.message.includes("URL_EXISTS"))) {
                        console.log(`Site ${site.block_urls} already exists in API, skipping...`);
                        continue;
                    }
                    
                    // Extract detailed error info
                    console.error("Full error:", error);
                    
                    // Format a user-friendly error message
                    let errorMessage = "Unknown error occurred";
                    
                    if (error.response?.data?.message) {
                        errorMessage = error.response.data.message;
                    } else if (error.response?.data?.error) {
                        errorMessage = error.response.data.error;
                    } else if (error.message) {
                        errorMessage = error.message;
                    }
                    
                    // Show error but continue with next site
                    displayMessage({
                        message: `Error syncing ${site.block_urls}: ${errorMessage}`,
                        type: "warning"
                    });
                }
            }

            // Success message after all sites processed
            const successMsg = { 
                message: `Successfully synced ${blockedUrls.length} sites`, 
                type: "success" 
            };
            displayMessage(successMsg);
            
            console.log('Sync completed - sites are now in both API and local storage');

        } catch (error) {
            console.error("Error in sync process:", error);
            
            // Extract error message from various possible locations
            let errorMessage = "Unknown error occurred";
            if (error.message) {
                errorMessage = error.message;
            } else if (error.data?.message) {
                errorMessage = error.data.message;
            } else if (error.response?.data?.message) {
                errorMessage = error.response.data.message;
            }

            // Show error message to user
            displayMessage({
                message: `Error syncing blocked sites: ${errorMessage}`,
                type: "error"
            });
        }
    };

    const toggleForm = () => {
        setIsRegister(!isRegister);
        setIsForgotPassword(false);
    };

    const showForgotPasswordForm = () => {
        setIsForgotPassword(true);
    };

    const goBackToLogin = () => {
        setIsForgotPassword(false);
    };

    const validateLoginForm = (values) => {
        const errors = {};
        if (!values.email?.trim()) {
            errors.email = "Email is required";
        }

        if (!values.password.trim()) {
            errors.password = "Password is required";
        } else if (values.password.trim().length < 6) {
            errors.password = "Password must be at least 6 characters";
        }

        return errors;
    };

    const handleResendOTP = async (email) => {
        setIsVerifyLoading(true);
        AxiosServices.post(ApiUrlServices.RESEND_OTP, { email })
            .then(() => {
                if (chrome.runtime) {
                    // Navigate to verify.html instead of opening options page
                    chrome.tabs.create({ url: `verify.html?email=${encodeURIComponent(verificationEmail.trim())}` });
                }
            })
            .catch((error) => {
                const msg = { message: "Failed to send verification email", type: "error" };
                displayMessage(msg);
            })
            .finally(() => {
                setIsVerifyLoading(false);
            });
    };

    const loginSubmitForm = async (values) => {
        setIsLoading(true);
        const formData = {
            email: values.email.trim(),
            password: values.password.trim(),
        };

        AxiosServices.post(ApiUrlServices.SIGN_IN, formData)
            .then(async (response) => {
                setVerificationEmail("");
                const msg = { message: "Logged in successfully", type: "success" };
                displayMessage(msg);

                localStorage.setItem("access_token", response.data.data.access_token);
                localStorage.setItem(sessionData, JSON.stringify(response.data.data));

                chrome.storage.local.set({ access_token: response.data.data.access_token }, async () => {
                    // Sync local blocked sites to API
                    await syncLocalBlockedSitesToApi();

                    // Fetch current server state and update local storage
                    try {
                        const serverResponse = await AxiosServices.get(ApiUrlServices.GET_URL_LIST);
                        const serverUrls = serverResponse.data.data.urls || [];
                        
                        // Update local storage with server state
                        chrome.storage.local.set({ 'blocked_urls': serverUrls }, () => {
                            console.log('Local storage updated with server state after login');
                        });
                        
                        // Clear WebSocket cache and reinitialize
                        try {
                            const webSocketApiService = (await import('../../services/WebSocketApiService.js')).default;
                            webSocketApiService.disconnect();
                            await webSocketApiService.initialize();
                        } catch (wsError) {
                            console.warn('WebSocket reinitialization failed:', wsError);
                        }
                    } catch (fetchError) {
                        console.error('Failed to fetch server state after login:', fetchError);
                    }

                    // Trigger storage event to update UI
                    window.dispatchEvent(new Event('storage'));
                });

                if (chrome.runtime && chrome.runtime.openOptionsPage) {
                    chrome.runtime.openOptionsPage(() => {
                        if (onBackToHome) {
                            onBackToHome();
                        } else {
                            window.location.reload();
                        }
                    });
                } else {
                    if (onBackToHome) {
                        onBackToHome();
                    } else {
                        window.location.reload();
                    }
                }
            })
            .catch((error) => {
                // Log the entire error object to see its structure
                console.log('Login error:', error);
                
                // The error object should contain data from the API response
                const errorData = error.data || {};
                
                // Log the error data for debugging
                console.log('Error data:', errorData);
                
                if (errorData.code === "INVALID_CREDENTIAL") {
                    const msg = { message: "Email or password is incorrect.", type: "error" };
                    displayMessage(msg);
                    setVerificationEmail("");
                } 
                else if (errorData.code === "EMAIL_NOT_VERIFIED") {
                    setVerificationEmail(values.email);
                    const msg = { message: "Email not verified. Please verify your email.", type: "error" };
                    displayMessage(msg);
                } 
                else if (errorData.code === "WRONG_PASSWORD") {
                    setVerificationEmail("");
                    const msg = { message: "Incorrect password. Try again.", type: "error" };
                    displayMessage(msg);
                } 
                else if (errorData.code === "USER_NOT_FOUND") {
                    setVerificationEmail("");
                    const msg = { message: "No account found. Please sign up to continue.", type: "error" };
                    displayMessage(msg);
                } 

                else {
                    // Fallback for any other errors
                    // Use error.message which is set by formatAxiosError
                    const errorMessage = errorData.error || errorData.message || error.message || "Login failed. Please try again later.";
                    const msg = { message: errorMessage, type: "error" };
                    displayMessage(msg);
                    setVerificationEmail("");
                }
            })
            .finally(() => {
                setIsLoading(false);
            });
    };

    const loginForm = useFormik({
        initialValues: {
            email: "",
            password: "",
        },
        validateOnChange: true,
        validateOnBlur: true,
        validate: validateLoginForm,
        onSubmit: loginSubmitForm,
    });

    return (
        <div className="form-container" ref={containerRef}>
            {/* Back to Home button */}
            {onBackToHome && (
                <div className="back-button-bottom">
                    <button
                        onClick={onBackToHome}
                        className="back-button"
                    >
                        <ArrowLeft size={16} />
                        Back to Home
                    </button>
                </div>
            )}

            {isForgotPassword ? (
                <ForgotPassword goBackToLogin={goBackToLogin} setMessage={displayMessage} />
            ) : isRegister ? (
                <Register toggleForm={toggleForm} setMessage={displayMessage} />
            ) : (
                <div className="form-card">
                    <div className="card-header">
                        <h2 className="card-title">Login to Your Account</h2>
                        <MessageContainer message={localMessage} />
                    </div>
                    <div className="card-content">
                        <form className="form" id="loginForm" onSubmit={loginForm.handleSubmit}>
                            <InputField
                                placeholder="Enter Email"
                                type="text"
                                inputName="email"
                                label="Email Address"
                                asterisk={true}
                                onBlur={loginForm.handleBlur}
                                value={loginForm.values.email}
                                onchangeCallback={loginForm.handleChange}
                                inputClassName={`${loginForm.touched.email && loginForm.errors.email ? " is-invalid" : ""}`}
                                requiredMessage={loginForm.touched.email && loginForm.errors.email}
                                requiredMessageLabel={loginForm.touched.email || loginForm.isSubmitting ? loginForm.errors.email : ""}
                            />
                            {verificationEmail && (
                                <div className="unverified-user">
                                    Email not verified. Please
                                    <button
                                        onClick={(e) => {
                                            if (!isVerifyLoading) {
                                                handleResendOTP(verificationEmail);
                                            }
                                        }}
                                        disabled={isVerifyLoading}
                                    >
                                        Verify now
                                        {isVerifyLoading && <Loader2 className="loader-icon" size={12} />}
                                    </button>
                                </div>
                            )}

                            <InputField
                                placeholder="Enter Password"
                                type="password"
                                inputName="password"
                                label="Password"
                                asterisk={true}
                                onBlur={loginForm.handleBlur}
                                value={loginForm.values.password}
                                onchangeCallback={loginForm.handleChange}
                                inputClassName={`${loginForm.touched.password && loginForm.errors.password ? " is-invalid" : ""}`}
                                requiredMessage={loginForm.touched.password && loginForm.errors.password}
                                requiredMessageLabel={loginForm.touched.password || loginForm.isSubmitting ? loginForm.errors.password : ""}
                            />
                            <div className="form-footer">
                                <a href="#forgot-password" onClick={showForgotPasswordForm} className="forgot-password">
                                    Forgot password?
                                </a>
                            </div>

                            <CustomButton
                                disabled={isLoading}
                                isLoading={isLoading}
                                groupIcon={<LogIn className="input-icon" size={15} />}
                                fullWidth
                                loadingText="Signing In..."
                                type="submit"
                            >
                                Sign In
                            </CustomButton>

                            <div className="register-prompt">
                                Don't have an account?{" "}
                                <a href="#register" onClick={toggleForm} className="register-link">
                                    Register now
                                </a>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}

export default Login;