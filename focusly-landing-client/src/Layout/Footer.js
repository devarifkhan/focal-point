import React from 'react';
import Logo from "../assets/img/logo-full-black.svg";
import {Link} from "react-router-dom";
import {Facebook, Instagram, Linkedin} from "lucide-react";
import Path from "../networks/path";

const Footer = () => {
    return (
        <footer className="footer">
            <div className="container footer-content">
                <div className="social-links">
                    <Link to="#">
                        <Facebook/>
                    </Link>
                    <Link to="#">
                        <Linkedin/>
                    </Link>
                    <Link to="#">
                        <Instagram/>
                    </Link>
                </div>
                <div className="footer-links">
                    <Link to={Path.privacyPolicy}>Privacy Policy</Link>
                    <Link to={Path.termsOfService}>Terms of Service</Link>
                </div>
            </div>
            <div className="copyright">© {new Date().getFullYear()} Focusly.pro, Powered by <Link
                className="shadhin_lab" target="_blank" to="https://shadhinlab.com/">Shadhin Lab LLC</Link> - All
                rights reserved.
            </div>
        </footer>
    );
};

export default Footer;