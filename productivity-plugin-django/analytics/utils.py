from analytics.models import UserActivity
from django.utils import timezone
from django.db.models import F

def track_blocked_attempt(user, blocked_url, estimated_time_minutes=5):
    """
    Track when a user attempts to visit a blocked site
    estimated_time_minutes: Average time user would spend on the site
    """
    today = timezone.now().date()
    
    activity, created = UserActivity.objects.get_or_create(
        user=user,
        date=today,
        defaults={
            'urls_blocked': 0,
            'time_saved_minutes': 0.0,
            'sites_visited': 0
        }
    )
    
    # Increment counters
    activity.urls_blocked = F('urls_blocked') + 1
    activity.time_saved_minutes = F('time_saved_minutes') + estimated_time_minutes
    activity.sites_visited = F('sites_visited') + 1
    activity.save()
    
    return activity