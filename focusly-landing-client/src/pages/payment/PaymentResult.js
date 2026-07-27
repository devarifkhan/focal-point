import React, { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import PaymentStatusModal from './PaymentStatusModal';
import UserService from '../../services/userService';
import { sessionData } from '../../config/sessionKeys';

const PaymentResult = () => {
    const [searchParams] = useSearchParams();
    const [showModal, setShowModal] = useState(true);
    const [planData, setPlanData] = useState(null);
    
    const status = searchParams.get('status');
    const transactionId = searchParams.get('transaction_id');

    useEffect(() => {
        const fetchPlanConfig = async () => {
            if (status === 'success') {
                try {
                    const result = await UserService.getPlanConfig();
                    setPlanData(result.data);
                    
                    // Update session data with new plan info
                    const currentSession = JSON.parse(localStorage.getItem(sessionData) || '{}');
                    const updatedSession = {
                        ...currentSession,
                        ...result.data
                    };
                    localStorage.setItem(sessionData, JSON.stringify(updatedSession));
                } catch (error) {
                    console.error('Failed to fetch plan config:', error);
                }
            }
        };

        fetchPlanConfig();
    }, [status]);

    return (
        <PaymentStatusModal
            isOpen={showModal}
            onClose={() => window.location.href = '/dashboard'}
            status={status}
            onGoHome={() => window.location.href = '/'}
            planName={planData?.subscription_plan || 'Premium Plan'}
            transactionId={transactionId}
        />
    );
};

export default PaymentResult;