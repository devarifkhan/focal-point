import AxiosServices from '../networks/AxiosService';
import ApiUrlServices from '../networks/ApiUrlServices';

const AnalyticsService = {
    getDashboardAnalytics: async (startDate, endDate) => {
        const params = {};
        if (startDate) params.start_date = startDate;
        if (endDate) params.end_date = endDate;
        
        const response = await AxiosServices.get(ApiUrlServices.DASHBOARD_ANALYTICS, params);
        return response.data;
    }
};

export default AnalyticsService;