const ApiUrlServices = {
    SIGN_UP: "/user/register",
    SIGN_IN: "/user/login",
    FORGET_PASSWORD: "/user/forget_password",
    ADD_URL: "/urls/add",
    GET_URL_LIST: "/urls/retrive_urls_list",
    UPDATE_BLOCKED_ITEM: (id) => `/urls/update_url/${id}`,
    DELETE_BLOCKED_ITEM: (id) => `/urls/delete_url/${id}`,
    RESET_TIME: (id) => `/urls/reset_time/${id}`,
    VERIFY_OTP: "/user/verify_email",
    RESEND_OTP: "/user/resend_otp",
    DASHBOARD_ANALYTICS: "/analytics/dashboard",
    RESET_ALL_URLS: "/urls/reset_all_urls/",
};

export default ApiUrlServices;
