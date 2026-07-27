import AxiosServices from '../networks/AxiosService';
import ApiUrlServices from '../networks/ApiUrlServices';
import UserService from './userService';
import { sessionData } from '../config/sessionKeys';

const PaymentService = {
    initiatePayment: async (phoneNumber) => {
        const response = await AxiosServices.post(ApiUrlServices.INITIATE_PAYMENT, {
            phone_number: phoneNumber
        });
        return response.data;
    },

    handlePaymentCallback: async (status, paymentData) => {
        const response = await AxiosServices.post(
            `${ApiUrlServices.PAYMENT_CALLBACK}?status=${status}`,
            paymentData
        );
        
        // Fetch updated plan config after successful payment
        if (response.data.status_code === 200) {
            const planConfig = await UserService.getPlanConfig();
            return { ...response.data, planConfig };
        }
        
        return response.data;
    },

    getMyPayments: async () => {
        const response = await AxiosServices.get(ApiUrlServices.MY_PAYMENTS);
        
        // Update session data if successful payments found
        if (response.data.status_code === 200 && response.data.data.payments.some(p => p.status === 'SUCCESS')) {
            try {
                const planConfig = await UserService.getPlanConfig();
                const currentSession = JSON.parse(localStorage.getItem(sessionData) || '{}');
                const updatedSession = { ...currentSession, ...planConfig.data };
                localStorage.setItem(sessionData, JSON.stringify(updatedSession));
            } catch (error) {
                console.error('Failed to update session after payment check:', error);
            }
        }
        
        return response.data;
    }
};

export default PaymentService;