import React, { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import PaymentStatusModal from './PaymentStatusModal';
import PaymentService from '../../services/paymentService';
import UserService from '../../services/userService';

const PaymentCallback = () => {
    const [searchParams] = useSearchParams();
    const [showModal, setShowModal] = useState(false);
    const [paymentStatus, setPaymentStatus] = useState(null);
    const [isProcessing, setIsProcessing] = useState(true);
    const [planData, setPlanData] = useState(null);

    useEffect(() => {
        const processCallback = async () => {
            const status = searchParams.get('status');
            const tranId = searchParams.get('tran_id');
            
            if (status && tranId) {
                const callbackData = {
                    tran_id: tranId,
                    status: status.toUpperCase(),
                    ...(status === 'success' && {
                        amount: searchParams.get('amount'),
                        currency: 'BDT',
                        bank_tran_id: searchParams.get('bank_tran_id')
                    })
                };
                
                try {
                    const result = await PaymentService.handlePaymentCallback(status, callbackData);
                    
                    // Always fetch plan config after successful payment
                    if (status === 'success' && result.status_code === 200) {
                        try {
                            const planConfig = await UserService.getPlanConfig();
                            setPlanData(planConfig.data);
                        } catch (planError) {
                            console.error('Failed to fetch plan config:', planError);
                        }
                    }
                } catch (error) {
                    console.error('Callback error:', error);
                }
                
                setPaymentStatus(status);
            }
            
            setIsProcessing(false);
            setShowModal(true);
        };

        processCallback();
    }, [searchParams]);

    if (isProcessing) {
        return <div style={{ textAlign: 'center', padding: '50px' }}>Processing payment...</div>;
    }

    return (
        <PaymentStatusModal
            isOpen={showModal}
            onClose={() => window.location.href = '/dashboard'}
            status={paymentStatus}
            onGoHome={() => window.location.href = '/'}
            planName={planData?.subscription_plan || 'Premium Plan'}
            amount={searchParams.get('amount') || ''}
            transactionId={searchParams.get('tran_id')}
        />
    );
};

export default PaymentCallback;