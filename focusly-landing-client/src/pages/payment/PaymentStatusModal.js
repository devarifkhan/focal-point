import React from 'react';
import {CheckCircle, XCircle, AlertCircle, CreditCard} from 'lucide-react';
import CustomModal from "../../components/common/CustomModal/CustomModal";
import "./static/PaymentStatusModal.css";

const PaymentStatusModal = ({
                                isOpen,
                                onClose,
                                status, // 'success', 'failed', 'cancelled'
                                onGoHome,
                                planName = "Premium Plan",
                                amount = "2.99",
                                transactionId = null,
                                errorMessage = null
                            }) => {
    const getStatusConfig = () => {
        switch (status) {
            case 'success':
                return {
                    icon: CheckCircle,
                    iconColor: '#10b981',
                    iconBgColor: '#d1fae5',
                    title: 'Payment Successful!',
                    subtitle: 'Welcome to Focusly Premium',
                    message: `Thank you for subscribing to ${planName}. Your payment of $${amount} has been processed successfully.`,
                    primaryButtonText: 'Get Started',
                    primaryButtonAction: onGoHome,
                    secondaryButtonText: 'Close',
                    secondaryButtonAction: onClose,
                    showSecondaryButton: true
                };
            case 'failed':
                return {
                    icon: XCircle,
                    iconColor: '#ef4444',
                    iconBgColor: '#fee2e2',
                    title: 'Payment Failed',
                    subtitle: 'We couldn\'t process your payment',
                    message: errorMessage || 'Your payment could not be processed. Please contact support or try again later.',
                    primaryButtonText: 'Close',
                    primaryButtonAction: onClose,
                    secondaryButtonText: 'Go Home',
                    secondaryButtonAction: onGoHome,
                    showSecondaryButton: !!onGoHome
                };
            case 'cancelled':
                return {
                    icon: AlertCircle,
                    iconColor: '#f59e0b',
                    iconBgColor: '#fef3c7',
                    title: 'Payment Cancelled',
                    subtitle: 'Your payment was cancelled',
                    message: 'No charges have been made to your account. You can visit our pricing page anytime to subscribe.',
                    primaryButtonText: 'Close',
                    primaryButtonAction: onClose,
                    secondaryButtonText: 'Go Home',
                    secondaryButtonAction: onGoHome,
                    showSecondaryButton: !!onGoHome
                };
            case 'info':
                return {
                    icon: AlertCircle,
                    iconColor: '#3b82f6',
                    iconBgColor: '#dbeafe',
                    title: 'Already Subscribed',
                    subtitle: 'You\'re all set!',
                    message: errorMessage || 'You are already on a paid plan.',
                    primaryButtonText: 'Go to Dashboard',
                    primaryButtonAction: () => window.location.href = '/dashboard',
                    secondaryButtonText: 'Close',
                    secondaryButtonAction: onClose,
                    showSecondaryButton: true
                };
            default:
                return {
                    icon: CreditCard,
                    iconColor: '#6b7280',
                    iconBgColor: '#f3f4f6',
                    title: 'Payment Status',
                    subtitle: 'Processing...',
                    message: 'Please wait while we process your payment.',
                    primaryButtonText: 'Close',
                    primaryButtonAction: onClose,
                    secondaryButtonText: null,
                    showSecondaryButton: false
                };
        }
    };

    const config = getStatusConfig();
    const IconComponent = config.icon;

    const modalContent = (
        <div className="payment-status-content">
            {/* Status Icon */}
            <div
                className="payment-status-icon"
                style={{backgroundColor: config.iconBgColor}}
            >
                <IconComponent
                    size={32}
                    color={config.iconColor}
                />
            </div>

            {/* Status Text */}
            <div className="payment-status-text">
                <h2 className="payment-status-title">{config.title}</h2>
                <p className="payment-status-subtitle">{config.subtitle}</p>
                <p className="payment-status-message">{config.message}</p>
            </div>

            {/* Transaction Details (for success) */}
            {status === 'success' && (
                <div className="payment-details">
                    <div className="payment-detail-row">
                        <span className="payment-detail-label">Plan:</span>
                        <span className="payment-detail-value">{planName}</span>
                    </div>
                    <div className="payment-detail-row">
                        <span className="payment-detail-label">Amount:</span>
                        <span className="payment-detail-value">${amount}</span>
                    </div>
                    {transactionId && (
                        <div className="payment-detail-row">
                            <span className="payment-detail-label">Transaction ID:</span>
                            <span className="payment-detail-value payment-transaction-id">{transactionId}</span>
                        </div>
                    )}
                </div>
            )}

            {/* Error Details (for failed payments) */}
            {status === 'failed' && errorMessage && (
                <div className="payment-error-details">
                    <p className="payment-error-label">Error Details:</p>
                    <p className="payment-error-text">{errorMessage}</p>
                </div>
            )}

            {/* Additional Info */}
            {status === 'success' && (
                <div className="payment-success-note">
                    <p>You'll receive a confirmation email shortly. Your premium features are now active!</p>
                </div>
            )}

            {status === 'cancelled' && (
                <div className="payment-cancelled-note">
                    <p>Your free trial continues. Visit our pricing page anytime to unlock all premium features.</p>
                </div>
            )}
        </div>
    );

    return (
        <CustomModal
            isOpen={isOpen}
            onClose={onClose}
            title="" // We'll handle the title in our custom content
            showFooter={false} // We'll handle buttons in our custom content
        >
            {modalContent}
        </CustomModal>
    );
};

export default PaymentStatusModal;