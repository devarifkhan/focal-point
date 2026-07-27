import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import siteConfig from "../../config/site-config";
import { Premium } from "../../config/config";
import PaymentService from '../../services/paymentService';
import PaymentStatusModal from './PaymentStatusModal';
import { sessionData } from '../../config/sessionKeys';

const Checkout = () => {
    const navigate = useNavigate();
    const [isLoading, setIsLoading] = useState(false);
    const [showModal, setShowModal] = useState(false);
    const [paymentStatus, setPaymentStatus] = useState(null);
    const [errorMessage, setErrorMessage] = useState('');
    const [phoneNumber, setPhoneNumber] = useState('');

    useEffect(() => {
        const userData = JSON.parse(localStorage.getItem(sessionData) || '{}');
        if (userData.subscription_plan === 'PREMIUM') {
            navigate('/dashboard');
        }
    }, [navigate]);

    const handlePayment = async (e) => {
        e.preventDefault();
        setIsLoading(true);
        try {
            const response = await PaymentService.initiatePayment(phoneNumber);
            if (response.success && response.data.payment_url) {
                window.location.href = response.data.payment_url;
            }
        } catch (error) {
            const errorData = error.response?.data;
            if (errorData?.code === 'ALREADY_PAID') {
                setPaymentStatus('info');
                setErrorMessage('You are already on a paid plan. No additional payment is required.');
            } else {
                setPaymentStatus('failed');
                setErrorMessage(errorData?.message || error.message || 'Payment initiation failed');
            }
            setShowModal(true);
        } finally {
            setIsLoading(false);
        }
    };

    const handleCloseModal = () => setShowModal(false);
    const handleGoHome = () => window.location.href = '/';

    return (
        <div>
            <div className="checkout-container">
                <div className="plan-summary">
                    <div>
                        <div className="plan-header">
                            <span className="plan-badge">Popular</span>
                            <h2 className="plan-title">Premium</h2>
                            <div className="plan-price">
                                ${siteConfig.premium_fee}<span className="period">/Year</span>
                            </div>
                        </div>

                        <ul className="features-list">
                            <li>Unlimited website blocking</li>
                            <li>Advanced time tracking</li>
                            <li>Detailed analytics</li>
                            <li>Productivity tips</li>
                            <li>Instant and Schedule blocking</li>
                            <li>Priority support</li>
                        </ul>
                    </div>
{/* 
                    <div className="money-back">
                        <strong>30-day money-back guarantee</strong><br/>
                        Try risk-free. Cancel anytime.
                    </div> */}
                </div>

                <div className="checkout-form">
                    <div className="checkout-header">
                        <h2>Complete Your Purchase</h2>
                        <p>Secure checkout powered by SSL</p>
                    </div>

                    <form id="checkout-form" onSubmit={handlePayment}>
                        {/* <div className="input-group">
                            <label htmlFor="email">Email</label>
                            <input
                                type="email"
                                id="email"
                                value={JSON.parse(localStorage.getItem(sessionData) || '{}').user_data?.email || ''}
                                disabled
                            />
                        </div> */}

                        <div className="input-group">
                            <label htmlFor="phone">Phone Number</label>
                            <input
                                type="tel"
                                id="phone"
                                value={phoneNumber}
                                onChange={(e) => setPhoneNumber(e.target.value)}
                                placeholder="8801234567890"
                                required
                            />
                        </div>

                        <button 
                            type="submit" 
                            className="payment-button" 
                            id="pay-button"
                            disabled={isLoading || !Premium}
                        >
                            {isLoading ? 'Processing...' : `Complete Purchase - $${siteConfig.premium_fee}`}
                        </button>

                        <div className="security-notice">
                            Your payment information is encrypted and secure
                        </div>

                        <div className="legal-links">
                            By completing this purchase, you agree to our &nbsp;
                            <a href="/terms-of-service" target="_blank">Terms of Service</a>&nbsp; and
                            <a href="/privacy-policy" target="_blank">&nbsp; Privacy Policy</a>
                        </div>
                    </form>
                </div>
            </div>

            <PaymentStatusModal
                isOpen={showModal}
                onClose={handleCloseModal}
                status={paymentStatus}
                onGoHome={handleGoHome}
                planName="Premium Plan"
                amount={siteConfig.premium_fee}
                errorMessage={errorMessage}
            />
        </div>
    );
};

export default Checkout;