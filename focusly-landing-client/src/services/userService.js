import AxiosServices from '../networks/AxiosService';
import ApiUrlServices from '../networks/ApiUrlServices';

const UserService = {
    getPlanConfig: async () => {
        const response = await AxiosServices.get(ApiUrlServices.PLAN_CONFIG);
        return response.data;
    },
    
    verifyOTP: async (email, code) => {
        const response = await AxiosServices.post(ApiUrlServices.VERIFY_OTP, { email, code });
        return response.data;
    },
    
    resendOTP: async (email) => {
        const response = await AxiosServices.post(ApiUrlServices.RESEND_OTP, { email });
        return response.data;
    }
};

export default UserService;