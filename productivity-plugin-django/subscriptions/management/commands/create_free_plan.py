from django.core.management.base import BaseCommand
from subscriptions.models import SubscriptionPlan

class Command(BaseCommand):
    help = "Create a FREE subscription plan if it doesn't exist."

    def handle(self, *args, **kwargs):
        try:
            free_plan, created = SubscriptionPlan.objects.get_or_create(
                plan="FREE",
                defaults={
                    "plan_duartion": 30,  # 30 days free
                    "max_url_storage": 10,  # Example: 10 URLs
                    "price": 0.00
                }
            )
            if created:
                self.stdout.write(self.style.SUCCESS("FREE plan created successfully."))
            else:
                self.stdout.write(self.style.WARNING("FREE plan already exists."))
        except Exception as e:
            self.stdout.write(self.style.ERROR(f"Error creating FREE plan: {e}"))
