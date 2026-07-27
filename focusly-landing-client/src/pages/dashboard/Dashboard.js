import React, {useState, useEffect} from 'react';
import PaymentStatusModal from "../payment/PaymentStatusModal";
import siteConfig from "../../config/site-config";
import { Premium } from "../../config/config";
import { sessionData } from "../../config/sessionKeys";
import AnalyticsService from '../../services/analyticsService';
import PaymentService from '../../services/paymentService';
import UserService from '../../services/userService';
import './Dashboard.css';

const Dashboard = () => {
    const [modalState, setModalState] = useState({
        isOpen: false,
        status: null,
        transactionId: null
    });
    const [userData, setUserData] = useState(null);
    const [analytics, setAnalytics] = useState(null);
    const [isLoadingAnalytics, setIsLoadingAnalytics] = useState(false);
    const [payments, setPayments] = useState(null);
    const [startDate, setStartDate] = useState('');
    const [endDate, setEndDate] = useState('');

    useEffect(() => {
        const urlParams = new URLSearchParams(window.location.search);
        const status = urlParams.get('status');
        const transactionId = urlParams.get('transaction_id');

        if (status && ['success', 'failed', 'cancelled'].includes(status)) {
            setModalState({
                isOpen: true,
                status: status,
                transactionId: transactionId
            });
        }

        // Load session data
        const sessionInfo = localStorage.getItem(sessionData);
        if (sessionInfo) {
            setUserData(JSON.parse(sessionInfo));
        }

        // Load dashboard analytics
        fetchAnalytics();
        
        // Load payment history
        fetchPayments();
    }, []);

    const handleClose = () => {
        setModalState({isOpen: false, status: null, transactionId: null});

        // Remove query parameters from URL
        const urlParams = new URLSearchParams(window.location.search);
        urlParams.delete('status');
        urlParams.delete('transaction_id');

        const newUrl = urlParams.toString()
            ? `${window.location.pathname}?${urlParams.toString()}`
            : window.location.pathname;

        window.history.replaceState({}, '', newUrl);
    };

    const fetchAnalytics = async () => {
        setIsLoadingAnalytics(true);
        try {
            const result = await AnalyticsService.getDashboardAnalytics(startDate, endDate);
            console.log('Analytics data:', result.data);
            console.log('URLs limit:', result.data?.plan_usage?.urls_limit);
            setAnalytics(result.data);
        } catch (error) {
            console.error('Failed to fetch analytics:', error);
        } finally {
            setIsLoadingAnalytics(false);
        }
    };

    const fetchPayments = async () => {
        try {
            const result = await PaymentService.getMyPayments();
            setPayments(result.data);
        } catch (error) {
            console.error('Failed to fetch payments:', error);
        }
    };

    return (
        <div className="dashboard-container">
            <div className="dashboard-header">
                <h1 className="dashboard-title">Dashboard</h1>
                <p className="dashboard-subtitle">Monitor your productivity and website blocking activity</p>
            </div>

            <div className="dashboard-content">
                <div className="main-content">
                    <div className="filters-section">
                        <h3>Analytics Period</h3>
                        <div className="date-filters">
                            <input 
                                type="date" 
                                value={startDate} 
                                onChange={(e) => setStartDate(e.target.value)}
                                className="date-input"
                            />
                            <input 
                                type="date" 
                                value={endDate} 
                                onChange={(e) => setEndDate(e.target.value)}
                                className="date-input"
                            />
                            <button onClick={fetchAnalytics} className="filter-btn">Apply Filter</button>
                        </div>
                        {analytics && (
                            <p className="period-info">Showing data for {analytics.period}</p>
                        )}
                    </div>

                    <div className="stats-section">
                        <h3>Analytics Overview</h3>
                        {isLoadingAnalytics ? (
                            <div className="loading-container">
                                <div className="loading-spinner"></div>
                                <p>Loading analytics...</p>
                            </div>
                        ) : analytics ? (
                            <div className="analytics-grid">
                                    <div className="analytics-card">
                                        <h4>Total URLs</h4>
                                        <div className="analytics-value">{analytics.quick_stats?.total_urls || 0}</div>
                                    </div>
                                    <div className="analytics-card">
                                        <h4>Active URLs</h4>
                                        <div className="analytics-value">{analytics.quick_stats?.active_urls || 0}</div>
                                    </div>
                                    <div className="analytics-card">
                                        <h4>Inactive URLs</h4>
                                        <div className="analytics-value">{analytics.quick_stats?.inactive_urls || 0}</div>
                                    </div>
                                    <div className="analytics-card">
                                        <h4>Visited URLs</h4>
                                        <div className="analytics-value">{analytics.quick_stats?.visited_urls || 0}</div>
                                    </div>
                                    <div className="analytics-card">
                                        <h4>Total Time (min)</h4>
                                        <div className="analytics-value">{analytics.quick_stats?.total_time_minutes || 0}</div>
                                    </div>
                                    <div className="analytics-card">
                                        <h4>Avg Time/URL</h4>
                                        <div className="analytics-value">{analytics.quick_stats?.avg_time_per_url || 0}</div>
                                    </div>
                                    {/* <div className="analytics-card">
                                        <h4>Blocked Attempts</h4>
                                        <div className="analytics-value">{analytics.quick_stats?.total_blocked_attempts || 0}</div>
                                    </div> */}
                                    <div className="analytics-card">
                                        <h4>Sites Visited</h4>
                                        <div className="analytics-value">{analytics.quick_stats?.total_sites_visited || 0}</div>
                                    </div>
                            </div>
                        ) : (
                            <p>No analytics data available</p>
                        )}
                    </div>

                    {analytics && analytics.plan_usage?.current_plan !== 'PREMIUM' && (
                        <div className="plan-section">
                            <h3>Plan Usage</h3>
                            <div className="plan-usage-card">
                                <div className="usage-header">
                                    <div>
                                        <div className="current-plan">{analytics.plan_usage?.current_plan} Plan</div>
                                        <div className="usage-text">{analytics.plan_usage?.urls_used} of {analytics.plan_usage?.urls_limit === -1 ? 'Unlimited' : analytics.plan_usage?.urls_limit} URLs used</div>
                                    </div>
                                    {analytics.plan_usage?.urls_limit !== -1 && (
                                        <div className="usage-percentage">
                                            {analytics.plan_usage?.usage_percentage?.toFixed(1)}%
                                        </div>
                                    )}
                                </div>
                                {analytics.plan_usage?.urls_limit !== -1 && (
                                    <div className="usage-bar">
                                        <div 
                                            className="usage-fill" 
                                            style={{width: `${analytics.plan_usage?.usage_percentage || 0}%`}}
                                        ></div>
                                    </div>
                                )}
                            </div>
                        </div>
                    )}
                </div>

                <div className="sidebar">
                    {userData && (
                        <div className="user-profile-card">
                            <div className="profile-header">
                                <div className="profile-avatar">
                                    {userData.user_data?.first_name?.[0]}{userData.user_data?.last_name?.[0]}
                                </div>
                                <div className="profile-info">
                                    <h3 className="profile-name">{userData.user_data?.first_name} {userData.user_data?.last_name}</h3>
                                    <p className="profile-email">{userData.user_data?.email}</p>
                                </div>
                            </div>
                            <div className="profile-stats">
                                <div className="stat-item">
                                    <span className="stat-value">{userData.subscription_plan === 'PREMIUM' ? 'Unlimited' : userData.url_limit}</span>
                                    <span className="stat-label">URL Limit</span>
                                </div>
                                <div className="stat-item">
                                    <span className="stat-value">{(() => {
                                        if (userData.subscription_start_date && userData.duration_days) {
                                            const startDate = new Date(userData.subscription_start_date);
                                            const currentDate = new Date();
                                            const daysPassed = Math.ceil((currentDate - startDate) / (1000 * 60 * 60 * 24));
                                            const remainingDays = Math.max(0, userData.duration_days - daysPassed);
                                            
                                            if (remainingDays === 0 && userData.subscription_plan !== 'PREMIUM') {
                                                UserService.getPlanConfig().then(config => {
                                                    localStorage.setItem(sessionData, JSON.stringify({...userData, ...config}));
                                                    setUserData({...userData, ...config});
                                                }).catch(console.error);
                                            }
                                            
                                            return remainingDays;
                                        }
                                        return userData.duration_days || 0;
                                    })()}</span>
                                    <span className="stat-label">Days Remaining</span>
                                </div>
                            </div>
                            {userData.subscription_plan === 'FREE' && (
                                <div className="upgrade-section">
                                    <button 
                                        className="upgrade-btn"
                                        onClick={() => window.location.href = '/checkout'}
                                        disabled={!Premium}
                                    >
                                        Upgrade to Premium
                                    </button>
                                </div>
                            )}
                        </div>
                    )}
                    
                    {payments && (
                        <div className="payments-card">
                            <h3>Payment History</h3>
                            <div className="payments-list">
                                {payments.payments?.length > 0 ? (
                                    payments.payments.slice(0, 3).map((payment, index) => (
                                        <div key={index} className="payment-item">
                                            <div className="payment-info">
                                                <span className="payment-amount">${payment.amount}</span>
                                                <span className="payment-date">{new Date(payment.created_at).toLocaleDateString()}</span>
                                                <span className="payment-id">{payment.transaction_id}</span>
                                            </div>
                                            <span className={`payment-status ${payment.status?.toLowerCase()}`}>
                                                {payment.status}
                                            </span>
                                        </div>
                                    ))
                                ) : (
                                    <p className="no-payments">No payment history</p>
                                )}
                            </div>
                        </div>
                    )}
                </div>
            </div>

            <PaymentStatusModal
                isOpen={modalState.isOpen}
                onClose={handleClose}
                status={modalState.status}
                transactionId={modalState.transactionId}
                planName="Focusly Premium"
                amount={`${siteConfig.premium_fee}`}
            />
        </div>
    );
};

export default Dashboard;