import { ChevronDown, CircleUserRound, LogIn, LogOut, Settings, AlertTriangle } from "lucide-react";
import React, { useState, useEffect } from 'react';
import LogoFull from "../../assets/img/logo-full.svg";
import { sessionData } from "../../config/sessionKeys";
import CustomButton from "../common/CustomButton/CustomButton";


const Header = ({ onLoginClick, isLoginPage = false }) => {
    const [token, setToken] = useState(localStorage.getItem('access_token'));
    const [userData, setUserData] = useState(JSON.parse(localStorage.getItem(sessionData)));
    const [isDropdownOpen, setIsDropdownOpen] = useState(false);
    const [isLoggingOut, setIsLoggingOut] = useState(false);

    useEffect(() => {
        // Listen for storage changes (login/logout)
        const handleStorageChange = () => {
            setToken(localStorage.getItem('access_token'));
            setUserData(JSON.parse(localStorage.getItem(sessionData)));
        };
        
        window.addEventListener('storage', handleStorageChange);
        return () => {
            window.removeEventListener('storage', handleStorageChange);
        };
    }, []);

    const logout = async () => {
        if (isLoggingOut) return; // Prevent multiple logout attempts
        
        setIsLoggingOut(true);
        
        try {
            // Call handleLogout function first to maintain time tracking state
            // This function already properly preserves visited state and used_time
            const { handleLogout } = await import('../../pages/Background/modules/logoutHandler');
            await handleLogout();
            
            // After time tracking state is preserved, remove tokens
            localStorage.removeItem('access_token');
            localStorage.removeItem(sessionData);
            
            chrome.storage.local.remove('access_token', () => {
                // Dispatch a storage event to update the UI
                window.dispatchEvent(new Event('storage'));
                window.location.reload();
            });

            // Find and close the options tab
            chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
                if (tabs[0]) {
                    chrome.tabs.reload(tabs[0].id);
                }
            });
        } catch (error) {
            console.error('Error handling time tracking during logout:', error);
            setIsLoggingOut(false); // Reset loading state on error
        }
    }

    return (
        <header className="header">
            <div className="header-container">
                {/* Logo */}
                <div className="logo-container">
                    <div className="logo">
                        <img src={LogoFull} alt="Focusly.pro"/>
                    </div>
                </div>

                {/* User Menu */}
                {token ? (
                    <div className="user-menu">
                        <button
                            onClick={() => setIsDropdownOpen(!isDropdownOpen)}
                            className="user-button"
                        >
                            <CircleUserRound />
                            <span>{userData ? (userData?.user_data?.first_name + ' ' + userData?.user_data?.last_name) : 'Account'}</span>
                            <ChevronDown />
                        </button>

                        {isDropdownOpen && (
                            <div className="dropdown-menu">
                                {/* <a href={void 0} className="dropdown-item"
                                    onClick={() => chrome.runtime.openOptionsPage()}>
                                    <Settings />
                                    Block List
                                </a> */}
                                <a 
                                    href={void 0} 
                                    className={`dropdown-item ${isLoggingOut ? 'disabled' : ''}`} 
                                    onClick={logout}
                                >
                                    {isLoggingOut ? (
                                        <div className="loading-spinner" />
                                    ) : (
                                        <LogOut />
                                    )}
                                    {isLoggingOut ? ' Logging out...' : 'Logout'}
                                </a>
                            </div>
                        )}
                    </div>
                ) : (
                    // Show login button if not authenticated and not on login page
                    !isLoginPage && (
                        <div className="auth-section">
                            <div className="warning-container">
                                <AlertTriangle size={14} className="warning-icon" />
                                <div className="warning-tooltip">
                                    <div className="tooltip-text">
                                        <div>✨ Sign in to sync across devices</div>
                                        <div>and unlock premium features</div>
                                    </div>
                                </div>
                            </div>
                            <div className="login-btn-container">
                                <CustomButton
                                    onClick={onLoginClick}
                                    groupIcon={<LogIn className="input-icon" size={15} />}
                                >
                                    Sign In
                                </CustomButton>
                            </div>
                        </div>
                    )
                )}
            </div>
        </header>
    );
};

export default Header;