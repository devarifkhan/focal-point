from django.core.management.base import BaseCommand
from subscriptions.models import SubscriptionPlan

class Command(BaseCommand):
    help = "Create a PAID subscription plan if it doesn't exist."

    def handle(self, *args, **kwargs):
        try:
            premium_plan, created = SubscriptionPlan.objects.get_or_create(
                plan="PREMIUM",
                defaults={
                    "plan_duartion": 30,  # 30 days
                    "max_url_storage": -1,  # Unlimited URLs
                    "price": 2.00
                }
            )
            if created:
                self.stdout.write(self.style.SUCCESS("PREMIUM plan created successfully."))
            else:
                self.stdout.write(self.style.WARNING("PREMIUM plan already exists."))
        except Exception as e:
            self.stdout.write(self.style.ERROR(f"Error creating PREMIUM plan: {e}"))
