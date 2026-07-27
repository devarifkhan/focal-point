from django.db.models.signals import post_save
from django.dispatch import receiver
from users.models import User
from .tasks import schedule_reset_for_user
import logging

logger = logging.getLogger(__name__)

@receiver(post_save, sender=User)
def schedule_user_reset(sender, instance, created, **kwargs):
    """
    When a user is created or updated, schedule a reset task for their URLs.
    """
    try:
        if created:
            logger.info(f"Scheduling URL reset for new user {instance.id} with timezone {instance.timezone}")
        else:
            logger.info(f"Updating URL reset schedule for user {instance.id} with timezone {instance.timezone}")
        
        # Schedule the reset task
        schedule_reset_for_user.delay(instance.id, instance.timezone)
    except Exception as e:
        logger.error(f"Error scheduling URL reset for user {instance.id}: {str(e)}") 