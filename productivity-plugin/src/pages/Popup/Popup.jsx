import React, { useState, useEffect } from 'react';
import Login from '../../components/Login/Login';
import Home from '../../components/Home/Home';
import Header from '../../components/Header/Header';
import MessageContainer from '../../components/MessageContainer/MessageContainer';
import { Router } from 'react-chrome-extension-router';
import { LogIn } from 'lucide-react';
import CustomButton from '../../components/common/CustomButton/CustomButton';

const Popup = () => {
    const [token, setToken] = useState(localStorage.getItem('access_token'));
    const [showLogin, setShowLogin] = useState(false);
    const [message, setMessage] = useState({ type: "", message: "" });

    useEffect(() => {
        // Update token state if it changes
        const checkToken = () => {
            setToken(localStorage.getItem('access_token'));
        };
        
        window.addEventListener('storage', checkToken);
        return () => {
            window.removeEventListener('storage', checkToken);
        };
    }, []);

    // Add effect to log message changes
    useEffect(() => {
        if (message.message) {
            console.log("Popup message state changed:", message);
        }
    }, [message]);

    // Clear message after 5 seconds for success/info messages
    useEffect(() => {
        if (message.message && (message.type === 'success' || message.type === 'info')) {
            const timer = setTimeout(() => {
                setMessage({ type: "", message: "" });
            }, 5000);
            return () => clearTimeout(timer);
        }
    }, [message]);

    const handleLoginClick = () => {
        setShowLogin(true);
        // Clear any existing messages when switching views
        setMessage({ type: "", message: "" });
    };

    const handleBackToHome = () => {
        setShowLogin(false);
        // Clear any existing messages when switching views
        setMessage({ type: "", message: "" });
    };

    // Helper function to set messages with console logging for debugging
    const setMessageWithLog = (msg) => {
        console.log("Popup setMessage:", msg);
        setMessage(msg);
    };

    return (
        <div className="main-container">
            <div className="container">
                <Header onLoginClick={handleLoginClick} isLoginPage={showLogin} />
                <div className="main-content">
                    {/* Always show the MessageContainer at the top level */}
                    <MessageContainer message={message} />
                    
                    {showLogin ? (
                        // Show login component when showLogin is true
                        <Login onBackToHome={handleBackToHome} setMessage={setMessageWithLog} />
                    ) : (
                        // Show home component
                        <div>
                            <Home setMessage={setMessageWithLog} />
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default Popup;