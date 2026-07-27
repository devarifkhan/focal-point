from celery import shared_task
from django.utils import timezone
import pytz
from .models import Urls
from users.models import User
from analytics.models import UserActivity
from datetime import datetime
from django_celery_beat.models import PeriodicTask, CrontabSchedule
from django.db.models import Sum
import json
import logging
import random
import string

logger = logging.getLogger(__name__)

from django.conf import settings

@shared_task(bind=True, queue=settings.CELERY_QUEUE_NAME)
def reset_user_urls(self, user_id):
    """
    Reset all URLs for a specific user
    """
    try:
        # Log the exact time when the reset is happening with timezone info
        now = datetime.now()
        current_time = now.strftime('%Y-%m-%d %H:%M:%S')
        print(f"[{current_time}] Starting URL reset for user_id: {user_id}")
        logger.info(f"[{current_time}] Starting URL reset for user_id: {user_id}")
        logger.info(f"Current server hour: {now.hour}, minute: {now.minute}")
        
        # Start with user info for debugging
        try:
            user = User.objects.get(id=user_id)
            user_tz = user.timezone or 'Asia/Dhaka'
            logger.info(f"User {user_id} timezone: {user_tz}")
        except Exception as e:
            logger.error(f"Failed to get user timezone info: {e}")
        
        urls = Urls.objects.filter(user_id=user_id)
        if urls.exists():
            # Store daily usage data before reset
            total_time_used = urls.aggregate(total=Sum('used_time'))['total'] or 0
            visited_count = urls.filter(visited=True).count()
            
            # Save to UserActivity (update or create for today)
            today = datetime.now().date()
            activity, created = UserActivity.objects.update_or_create(
                user_id=user_id,
                date=today,
                defaults={
                    'urls_blocked': urls.count(),
                    'time_saved_minutes': total_time_used,
                    'sites_visited': visited_count
                }
            )
            
            url_list = []
            for url in urls:
                # Reset all fields to their default values
                # Block if no time limit
                url.visited = url.today_limit == 0
                url.half_time_notified = False
                url.one_quarter_notified = False
                url.three_quarter_notified = False
                url.used_time = 0.0
                url.today_limit = 0.0
                url.edit = False
                url.is_temporary = False
                url.temporary_time = url.default_time
                url.save()
                url_list.append(url.block_urls)
            
            logger.info(f"Stored daily data: {total_time_used} minutes, {visited_count} visits")
            logger.info(f"Reset {urls.count()} URLs for user_id: {user_id}")
            logger.info(f"Reset URLs: {', '.join(url_list)}")
            return {
                "message": f"Reset {urls.count()} URLs for user_id: {user_id}",
                "urls": url_list,
                "reset_time": current_time,
                "daily_data_stored": {
                    "time_used": total_time_used,
                    "sites_visited": visited_count,
                    "urls_blocked": urls.count()
                }
            }
        else:
            logger.info(f"No URLs found for user_id: {user_id}")
            return {
                "message": f"No URLs found for user_id: {user_id}",
                "urls": [],
                "reset_time": current_time
            }
    except Exception as e:
        logger.error(f"Error resetting URLs for user_id {user_id}: {e}")
        return {
            "message": f"Error: {str(e)}",
            "error": str(e)
        }

@shared_task
def schedule_reset_for_user(user_id, timezone_name='Asia/Dhaka'):
    """
    Schedule a reset task for a specific user at 6:05 PM in their timezone
    Only creates a task if the user has URLs to reset.
    """
    try:
        print(f"Starting schedule_reset_for_user for user_id={user_id}, timezone={timezone_name}")
        user = User.objects.get(id=user_id)
        tz = user.timezone or timezone_name
        
        # Count URLs before setting up the schedule
        url_count = Urls.objects.filter(user_id=user_id).count()
        urls = list(Urls.objects.filter(user_id=user_id).values_list('block_urls', flat=True))
        print(f"User {user_id} has {url_count} URLs: {urls}")
        
        # Delete ALL existing tasks for this user to prevent duplicates
        existing_tasks = PeriodicTask.objects.filter(
            task="urlshandler.tasks.reset_user_urls",
            args=json.dumps([user_id])
        )
        
        if existing_tasks.exists():
            task_count = existing_tasks.count()
            print(f"Deleting {task_count} existing scheduled tasks for user {user_id}")
            existing_tasks.delete()
            print(f"Deleted {task_count} existing tasks")
        else:
            print(f"No existing tasks found for user {user_id}")
        
        # Only create a new task if the user has URLs to reset
        if url_count > 0:
            print(f"Creating new task for user {user_id} with {url_count} URLs")
            
            # Create a unique schedule identifier for this user
            schedule_name = f"reset_schedule_user_{user_id}_{tz}"
            
            # We need to ensure the reset happens at 10:05 AM in the user's timezone
            hour = 10   # 10:05 AM in 24-hour format
            minute = 5

            # First, try to find an existing schedule with the exact same parameters
            existing_schedules = CrontabSchedule.objects.filter(
                hour=hour,
                minute=minute,
                day_of_week='*',
                day_of_month='*',
                month_of_year='*',
                timezone=tz
            )
            
            # If multiple schedules exist, delete all but the first one
            if existing_schedules.count() > 1:
                print(f"Found {existing_schedules.count()} duplicate schedules, cleaning up...")
                # Keep the first one, delete the rest
                schedule_to_keep = existing_schedules.first()
                CrontabSchedule.objects.filter(
                    hour=hour,
                    minute=minute,
                    day_of_week='*',
                    day_of_month='*',
                    month_of_year='*',
                    timezone=tz
                ).exclude(id=schedule_to_keep.id).delete()
                schedule = schedule_to_keep
            elif existing_schedules.exists():
                # Use the existing schedule
                schedule = existing_schedules.first()
            else:
                # Create a new schedule
                schedule = CrontabSchedule.objects.create(
                    hour=hour,
                    minute=minute,
                    day_of_week='*',
                    day_of_month='*',
                    month_of_year='*',
                    timezone=tz
                )
            
            # Use a simple, consistent task name
            task_name = f"Reset URLs for user {user_id} at 10:05 AM {tz}"
            
            # Create the periodic task with get_or_create to prevent duplicates
            task, created = PeriodicTask.objects.get_or_create(
                name=task_name,
                defaults={
                    'task': "urlshandler.tasks.reset_user_urls",
                    'crontab': schedule,
                    'args': json.dumps([user_id]),
                    'kwargs': json.dumps({}),
                    'enabled': True,
                    'description': f"Reset URLs for user {user.email} at 10:05 AM in {tz} timezone"
                }
            )
            
            if not created:
                # Update existing task
                task.crontab = schedule
                task.enabled = True
                task.save()
            
            action = "Created" if created else "Updated"
            print(f"Successfully {action.lower()} task with ID {task.id} for user {user_id}")
            logger.info(f"{action} URL reset schedule for user {user_id} at 10:05 AM in {tz} timezone")
            logger.info(f"Task scheduled for {url_count} URLs: {', '.join(urls) if urls else 'No URLs'}")
            
            return {
                "message": f"Scheduled URL reset for user {user_id} at 10:05 AM in {tz} timezone",
                "task_id": task.id,
                "user_email": user.email,
                "timezone": tz,
                "url_count": url_count,
                "urls": urls,
                "action": action.lower()
            }
        else:
            print(f"NOT creating a task for user {user_id} as they have no URLs")
            logger.info(f"No tasks created for user {user_id} as they have no URLs")
            return {
                "message": f"No tasks scheduled for user {user_id} as they have no URLs",
                "user_email": user.email,
                "timezone": tz,
                "url_count": 0,
                "urls": []
            }
    except User.DoesNotExist:
        error_msg = f"User with ID {user_id} does not exist"
        print(f"ERROR: {error_msg}")
        logger.error(error_msg)
        return {
            "message": f"Error: {error_msg}",
            "error": "User not found"
        }
    except Exception as e:
        error_msg = f"Error scheduling reset for user {user_id}: {e}"
        print(f"ERROR: {error_msg}")
        logger.error(error_msg)
        return {
            "message": f"Error: {str(e)}",
            "error": str(e)
        }

@shared_task
def schedule_resets_for_all_users():
    """
    Schedule URL reset tasks for all users at 12:00 AM in their respective timezones
    """
    users = User.objects.filter(is_active=True)
    results = []
    
    for user in users:
        result = schedule_reset_for_user(user.id, user.timezone)
        results.append(result)
    
    return results

@shared_task
def test_scheduled_task():
    """
    A simple test task that runs every minute to verify Celery Beat scheduling is working.
    """
    now = timezone.now()
    current_time = now.strftime('%Y-%m-%d %H:%M:%S')
    message = f"[{current_time}] Test scheduled task executed successfully! Hour: {now.hour}, minute: {now.minute}"
    print(message)
    logger.info(message)
    return {"status": "success", "time": current_time}

def setup_test_periodic_task():
    """
    Set up a test periodic task to run every minute.
    """
    try:
        # Delete any existing test tasks
        existing_tasks = PeriodicTask.objects.filter(
            name__contains="Test Task",
            task="urlshandler.tasks.test_scheduled_task"
        )
        if existing_tasks.exists():
            existing_tasks.delete()
            
        # Create or get schedule for every minute
        schedule, created = CrontabSchedule.objects.get_or_create(
            minute='*',
            hour='*',
            day_of_week='*',
            day_of_month='*',
            month_of_year='*',
            timezone='Asia/Dhaka'
        )
        
        # Create the periodic task
        task = PeriodicTask.objects.create(
            name=f"Test Task - {datetime.now().strftime('%Y%m%d%H%M%S')}",
            task="urlshandler.tasks.test_scheduled_task",
            crontab=schedule,
            enabled=True,
            description="Test task running every minute to verify Celery Beat"
        )
        
        print(f"Set up test task with ID {task.id}")
        logger.info(f"Set up test task with ID {task.id}")
        return True
    except Exception as e:
        print(f"Error setting up test task: {e}")
        logger.error(f"Error setting up test task: {e}")
        return False

@shared_task(bind=True, queue=settings.CELERY_QUEUE_NAME)
def send_payment_success_email(self, user_id, payment_id):
    """
    Send payment success email asynchronously
    """
    try:
        from subscriptions.models import Payment
        from subscriptions.email_utils import send_payment_email
        
        user = User.objects.get(id=user_id)
        payment = Payment.objects.get(id=payment_id)
        
        success = send_payment_email(user, payment, 'SUCCESS')
        
        if success:
            logger.info(f"Payment success email sent to {user.email} for transaction {payment.transaction_id}")
            return {"status": "success", "message": f"Success email sent to {user.email}"}
        else:
            logger.error(f"Failed to send payment success email to {user.email}")
            return {"status": "error", "message": "Failed to send email"}
            
    except Exception as e:
        logger.error(f"Error sending payment success email: {str(e)}")
        return {"status": "error", "message": str(e)}

@shared_task(bind=True, queue=settings.CELERY_QUEUE_NAME)
def send_payment_failed_email(self, user_id, payment_id):
    """
    Send payment failure email asynchronously
    """
    try:
        from subscriptions.models import Payment
        from subscriptions.email_utils import send_payment_email
        
        user = User.objects.get(id=user_id)
        payment = Payment.objects.get(id=payment_id)
        
        success = send_payment_email(user, payment, 'FAILED')
        
        if success:
            logger.info(f"Payment failure email sent to {user.email} for transaction {payment.transaction_id}")
            return {"status": "success", "message": f"Failure email sent to {user.email}"}
        else:
            logger.error(f"Failed to send payment failure email to {user.email}")
            return {"status": "error", "message": "Failed to send email"}
            
    except Exception as e:
        logger.error(f"Error sending payment failure email: {str(e)}")
        return {"status": "error", "message": str(e)}