from django.urls import path
from analytics.views import DashboardAPI, AdminAnalyticsAPI

urlpatterns = [
    path('dashboard/', DashboardAPI.as_view(), name='analytics_dashboard'),
    path('admin/overview/', AdminAnalyticsAPI.as_view(), name='admin_analytics'),
]