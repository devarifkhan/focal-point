import React, {useEffect, useState} from 'react';
import {Link, useNavigate} from "react-router-dom";
import {
    BarChart,
    BarChartIcon,
    Bell,
    Calendar,
    Clock, Lock,
    Play,
    Settings,
    SettingsIcon,
    ShieldPlus,
    LayoutDashboard
} from "lucide-react";
import SS1 from "../ss1.png";
import siteConfig from "../config/site-config";
import Path from "../networks/path";
import {useLocation} from "react-router-dom";
import { sessionData } from "../config/sessionKeys";
import {Premium} from "../config/config";

const HomePage = () => {
    const navigate = useNavigate();
    const location = useLocation();
    const [userPlan, setUserPlan] = useState(null);

    useEffect(() => {
        if (location.hash) {
            const sectionId = location.hash.replace("#", "");
            const section = document.getElementById(sectionId);
            const header = document.querySelector('.header');
            const headerHeight = header ? header.offsetHeight : 0;
            if (section) {
                window.scrollTo({
                    top: section.offsetTop - headerHeight,
                    behavior: "smooth"
                });
            }
        } else {
            window.scrollTo(0, 0);
        }

        // Check user plan
        const token = localStorage.getItem("access_token");
        if (token) {
            const userData = JSON.parse(localStorage.getItem(sessionData) || '{}');
            setUserPlan(userData.subscription_plan);
        }
    }, [location]);

    const checkoutToPremium = () => {
        const token = localStorage.getItem("access_token");
        if (token) {
            navigate(Path.checkout);
        } else {
            // set redirectTo to local storage
            localStorage.setItem("redirectTo", Path.checkout);
            // redirect to login page
            navigate(Path.signIn);
        }
    }

    return (
        <div className="homepage-main">
            {/* Hero Section */}
            <section className="hero">
                <div className="container">
                    <div className="hero-content">
                        <h1>Take control of your online time and boost productivity</h1>
                        <p>Block distracting websites and take control of your online time. Boost productivity with
                            smart domain blocking.</p>
                        <div className="btn-section">
                            {localStorage.getItem("access_token") ? (
                                <button className="button" onClick={() => navigate('/dashboard')}>
                                    <LayoutDashboard className="icon" size={20}/>  Go to Dashboard
                                </button>
                            ) : (
                                <button className="button">
                                    <Link target="_blank"
                                          to="https://chromewebstore.google.com/detail/focuslypro/npnkibckbohffnaclfcdebcilnocoiic?utm_source=ext_app_menu"><ShieldPlus
                                        className="icon" size={20}/> Add to Chrome</Link>
                                </button>
                            )}
                            <button className="button">
                                <Play className="icon" size={20}/> Watch Demo
                            </button>
                        </div>
                    </div>
                </div>
            </section>

            {/* Features Section */}
            <section className="features" id="features">
                <div className="container">
                    <div className="features-grid">
                        <div className="feature-item">
                            <div className="feature-icon">
                                <Clock/>
                            </div>
                            <h3>Time Management</h3>
                            <p>
                                Set custom time limits for each website or social media platform to manage your daily
                                usage effectively.
                            </p>
                        </div>
                        <div className="feature-item">
                            <div className="feature-icon">
                                <Bell/>
                            </div>
                            <h3>Smart Notifications</h3>
                            <p>
                                Receive timely warnings at 50% and 75% of your allocated time to help you plan your
                                browsing
                                accordingly.
                            </p>
                        </div>
                        <div className="feature-item">
                            <div className="feature-icon">
                                <Lock/>
                            </div>
                            <h3>Automatic Blocking</h3>
                            <p>
                                When you reach your time limit, the plugin automatically blocks access to the site until
                                the next day.
                            </p>
                        </div>
                        <div className="feature-item">
                            <div className="feature-icon">
                                <BarChart/>
                            </div>
                            <h3>Usage Analytics</h3>
                            <p>Track your social media usage patterns with detailed analytics to help you make better
                                decisions.</p>
                        </div>
                    </div>
                </div>
            </section>

            {/* Main Feature Section */}
            <section className="main-feature" id="about-us">
                <div className="container">
                    <div className="main-feature-content">
                        <div className="main-feature-content-left">
                            <h2>Take back control of your digital life</h2>
                            <p>
                                Our plugin helps you set healthy boundaries with distracting websites. You define which
                                sites to monitor
                                and how much time you want to spend on them each day. When your time is up, the plugin
                                blocks access
                                until the next day.
                            </p>
                            <button className="button">
                                <Link target="_blank"
                                      to="https://chromewebstore.google.com/detail/focuslypro/npnkibckbohffnaclfcdebcilnocoiic?utm_source=ext_app_menu"><ShieldPlus
                                    className="icon" size={20}/> Add to Chrome now</Link>
                            </button>
                        </div>
                        <div className="main-feature-content-right">
                            <img src={SS1} alt="Focusly"/>
                        </div>
                    </div>
                </div>
            </section>

            {/* How It Works Section */}
            <section className="how-it-works" id="how-it-works">
                <div className="container">
                    <h2>How It Works</h2>
                    <p>Simple steps to regain control of your time and boost productivity.</p>
                    <div className="steps-grid">
                        <div className="step-item">
                            <div className="step-icon">
                                <Settings/>
                            </div>
                            <h3>1. Set Your Limits</h3>
                            <p>Define which websites to monitor and set daily time limits for each one</p>
                        </div>
                        <div className="step-item">
                            <div className="step-icon">
                                <Bell/>
                            </div>
                            <h3>2. Get Notifications</h3>
                            <p>Receive warnings at 50% and 75% of your allocated time to stay aware</p>
                        </div>
                        <div className="step-item">
                            <div className="step-icon">
                                <Lock/>
                            </div>
                            <h3>3. Instant or Schedule Blocking</h3>
                            <p>When you reach 100% of your time, the site is blocked until midnight</p>
                        </div>
                    </div>
                    <div className="steps-grid">
                        <div className="step-item">
                            <div className="step-icon">
                                <Calendar/>
                            </div>
                            <h3>4. Daily Reset</h3>
                            <p>At midnight, all your time limits reset automatically for the next day</p>
                        </div>
                        <div className="step-item">
                            <div className="step-icon">
                                <BarChartIcon/>
                            </div>
                            <h3>5. Track Progress</h3>
                            <p>View detailed analytics about your usage patterns and productivity</p>
                        </div>
                        <div className="step-item">
                            <div className="step-icon">
                                <SettingsIcon/>
                            </div>
                            <h3>6. Adjust Settings</h3>
                            <p>Modify your time limits or temporarily unblock sites when needed</p>
                        </div>
                    </div>
                </div>
            </section>

            {/* Privacy Section */}
            <section className="privacy" id="privacy">
                <div className="container">
                    <h2>Your Privacy Matters</h2>
                    <p>
                        We understand the importance of your online privacy. Focusly.pro is designed to help you manage
                        your time
                        without compromising your personal data. We do not collect or store any of your browsing history
                        or personal
                        information. All your usage data is stored locally on your device and is never transmitted to
                        our servers.
                    </p>
                    <Link to="/privacy-policy">Learn more about our privacy practices</Link>
                </div>
            </section>

            {/* Plans Section */}
            <section className="plans" id="plans">
                <div className="container">
                    <h2>Choose Your Plan</h2>
                    <p>Select the plan that best fits your productivity needs.</p>
                    <div className="plans-grid">
                        <div className="plan-item">
                            <h3>Free</h3>
                            <p className="price">$0</p>
                            <ul>
                                <li>Block up to any 5 websites</li>
                                <li>Basic time tracking</li>
                                <li>Daily reset at midnight</li>
                                <li className="not-included">No analytics</li>
                                <li className="not-included">No productivity tips</li>
                            </ul>
                            <button className="button plan-free-btn">Get Started</button>
                        </div>
                        <div className="plan-item popular">
                            <span className="popular-tag">POPULAR</span>
                            <h3>Premium</h3>
                            <p className="price">
                                ${siteConfig.premium_fee}<span>/Year</span>
                            </p>
                            <ul>
                                <li>Unlimited website blocking</li>
                                <li>Advanced time tracking</li>
                                <li>Detailed analytics</li>
                                <li>Productivity tips</li>
                                <li>Instant and Schedule blocking</li>
                            </ul>
                            {userPlan === 'PREMIUM' ? (
                                <div className="premium-status">
                                    <button className="button premium-active-btn" disabled>
                                        ✓ Already on Premium
                                    </button>
                                    <p className="premium-message">You're enjoying all premium features!</p>
                                </div>
                            ) : (
                                <button className="button plan-premium-btn" onClick={checkoutToPremium} disabled={!Premium}>{Premium ? 'Upgrade to Pro' : 'Coming Soon'}</button>
                            )}
                        </div>
                    </div>
                </div>
            </section>
        </div>
    );
};

export default HomePage;