import React, {useState, useRef, useEffect} from 'react';
import {Link, useNavigate} from "react-router-dom";
import Logo from "../assets/img/logo-full-black.svg";
import {LogIn, User, LogOut} from "lucide-react";
import {sessionData} from "../config/sessionKeys";
import Path from "../networks/path";

const Header = () => {
    const navigate = useNavigate();
    const token = localStorage.getItem("access_token");
    const userData = JSON.parse(localStorage.getItem(sessionData) || "{}");
    const [dropdownOpen, setDropdownOpen] = useState(false);
    const menuRef = useRef(null);

    const handleDropdown = () => setDropdownOpen((open) => !open);

    useEffect(() => {
        const handleClickOutside = (event) => {
            if (menuRef.current && !menuRef.current.contains(event.target)) {
                setDropdownOpen(false);
            }
        };
        if (dropdownOpen) {
            document.addEventListener("mousedown", handleClickOutside);
        }
        return () => {
            document.removeEventListener("mousedown", handleClickOutside);
        };
    }, [dropdownOpen]);

    const logout = () => {
        localStorage.clear();
        setDropdownOpen(false);
        navigate(Path.home);
    };

    return (
        <header className="header">
            <div className="header-content">
                <div className="logo">
                    <Link to="/"><img src={Logo} alt="Focusly.pro"/></Link>
                </div>
                <nav className="nav">
                    <Link to="/">Home</Link>
                    <Link to="/#features">Features</Link>
                    <Link to="/#how-it-works">How It Works</Link>
                    <Link to="/#about-us">About Us</Link>
                    <Link to="/#plans">Pricing</Link>
                </nav>
                {token ? (
                    <div className="user-menu" ref={menuRef}>
                        <button className="user-button" onClick={handleDropdown}>
                            <User size="18"/>
                            {userData?.user_data?.first_name + ' ' + userData?.user_data?.last_name || "Account"}
                        </button>
                        {dropdownOpen && (
                            <div className="dropdown-menu">
                                <button className="dropdown-item" onClick={logout}>
                                    <LogOut size="14"/> Logout
                                </button>
                            </div>
                        )}
                    </div>
                ) : (
                    <button className="button auth-btn" onClick={() => navigate(Path.signIn)}>
                        <LogIn size="18"/> Sign In
                    </button>
                )}
            </div>
        </header>
    );
};

export default Header;