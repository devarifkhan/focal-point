const ApiUrlServices = {
    SIGN_UP: "/user/register",
    SIGN_IN: "/user/login",
    FORGET_PASSWORD: "/user/forget_password",
    ADD_URL: "/urls/add",
    GET_URL_LIST: "/urls/retrive_urls_list",
    UPDATE_BLOCKED_ITEM: (id) => `/urls/update_url/${id}`,
    DELETE_BLOCKED_ITEM: (id) => `/urls/delete_url/${id}`,
    VERIFY_OTP: "/user/verify_email",
    RESEND_OTP: "/user/resend_otp",
    URLS_ANALYTICS: "/urls/analytics",
    DASHBOARD_ANALYTICS: "/analytics/dashboard",
    INITIATE_PAYMENT: "/subscriptions/payment/initiate/",
    PAYMENT_CALLBACK: "/subscriptions/payment/",
    MY_PAYMENTS: "/subscriptions/my-payments/",
    ADMIN_PAYMENT_OVERVIEW: "/analytics/admin/overview",
    PLAN_CONFIG: "/user/plan_config"
};

export default ApiUrlServices;
