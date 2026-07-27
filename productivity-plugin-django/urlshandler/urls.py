from django.urls import path
from urlshandler.views import (
    UrlStore,
    RetriveUrlsList,
    DeleteUrl,
    UpdateUrlsView,
    ActiveUrlApi,
    AddCalenderView,
    ResetTime,
    ScheduledTasksView,
    UpdateTimezoneView,
    ManualResetUrls,
    TrackBlockedAttemptAPI,
    ResetAllUrls
)

urlpatterns = [
    path('add',UrlStore.as_view(),name='add_url'),
    path('retrive_urls_list/',RetriveUrlsList.as_view(),name='retrive_urls_list'),
    path('delete_url/<int:id>',DeleteUrl.as_view(),name="delete_url"),
    path('update_url/<int:id>',UpdateUrlsView.as_view(),name="update_url"),
    path('reset_time/<int:id>',ResetTime.as_view(),name="reset_time"),
    path('add_calender_url/<int:id>',AddCalenderView.as_view(),name="add_calender_url"),
    path('active_deactivate_url/<int:id>', ActiveUrlApi.as_view(),name="activate_deactivate_url"),
    
    # New URLs for scheduled tasks
    path('scheduled-tasks/', ScheduledTasksView.as_view(), name="scheduled_tasks"),
    path('update-timezone/', UpdateTimezoneView.as_view(), name="update_timezone"),
    path('manual-reset/', ManualResetUrls.as_view(), name="manual_reset_urls"),
    
    # Track blocked attempts for analytics
    path('track-blocked/', TrackBlockedAttemptAPI.as_view(), name="track_blocked_attempt"),
    
    # Reset all URLs
    path('reset_all_urls/', ResetAllUrls.as_view(), name='reset_all_urls'),

]