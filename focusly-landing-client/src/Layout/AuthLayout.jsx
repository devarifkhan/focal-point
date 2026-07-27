import "../assets/css/index.css";
import "../assets/css/verify.css";
import LogoFull from "../assets/img/logo-full.svg";
import {useNavigate} from "react-router-dom";
import {useEffect} from "react";
import Path from "../networks/path";

export default function AuthLayout({children}) {
    const navigate = useNavigate();

    const handleLogoClick = () => {
        navigate(Path.home);
    };

    useEffect(() => {
        const token = localStorage.getItem("access_token");
        if (token) {
            navigate(Path.dashboard);
        }
    }, [navigate]);

    if (localStorage.getItem("access_token")) {
        return null; // Prevent rendering the layout
    }

    return (
        <div className="verify-container">
            <div className="main-container">
                <header className="header">
                    <div className="header-container">
                        {/* Logo */}
                        <div className="logo-container">
                            <div className="logo">
                                <img src={LogoFull} alt="Focusly.pro" onClick={handleLogoClick} />
                            </div>
                        </div>
                    </div>
                </header>
                <div className="main-content">{children}</div>
            </div>
        </div>
    );
}
