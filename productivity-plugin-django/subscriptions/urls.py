from django.urls import path
from subscriptions.views import (
    RetrieveUserSubscriptionsAPI,
    ListSubscritionsPlanApi,
    UpgradeSubscriptionsPlanApi,
    PlanConfigAPI,
    InitiatePaymentAPI,
    PaymentCallbackAPI,
    AdminPaymentAnalyticsAPI,
    UserPaymentHistoryAPI
)

urlpatterns = [
    path('retrive_subcription_info',RetrieveUserSubscriptionsAPI.as_view(),name='retrive_subcription_info'),
    path('subscriptions_plan_list',ListSubscritionsPlanApi.as_view(),name='list_subscriptions_plan'),
    path('subscriptions_plan_update',UpgradeSubscriptionsPlanApi.as_view(),name="update_subscriptions"),
    path('plan_config',PlanConfigAPI.as_view(),name='plan_config'),
    
    # Payment Routes
    path('payment/initiate/',InitiatePaymentAPI.as_view(),name='initiate_payment'),
    path('payment/',PaymentCallbackAPI.as_view(),name='payment_callback'),
    
    # Admin & User Payment History
    path('admin/payments/',AdminPaymentAnalyticsAPI.as_view(),name='admin_payments'),
    path('my-payments/',UserPaymentHistoryAPI.as_view(),name='user_payments'),
]