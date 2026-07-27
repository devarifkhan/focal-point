from django.db.models.signals import post_save
from django.dispatch import receiver
from users.models import User
from datetime import datetime,timedelta
from subscriptions.models import SubscriptionPlan,Subscriptions

@receiver(post_save, sender=User)
def default_subscrition(sender,instance,created,**extra_args):

    if created:
        try:
            free_plan = SubscriptionPlan.objects.get(plan= "FREE")
            sub_end_time = datetime.now() + timedelta(days=180)
            Subscriptions.objects.create(sub_plan=free_plan,user=instance,subcription_end_at=sub_end_time).save()
            print("Subcription Added")
        except SubscriptionPlan.DoesNotExist:
            return f" Error Subscrition Plan Does Not Exists"