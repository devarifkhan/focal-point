from django.core.management.base import BaseCommand
from subscriptions.models import SubscriptionPlan
from django.conf import settings

class Command(BaseCommand):
    help = "Sync subscription plans with environment variables"

    def handle(self, *args, **kwargs):
        try:
            # Create or update FREE plan
            free_plan, created = SubscriptionPlan.objects.get_or_create(
                plan="FREE",
                defaults={
                    "plan_duartion": settings.FREE_PLAN_DURATION_DAYS,
                    "max_url_storage": settings.FREE_PLAN_URL_LIMIT,
                    "price": 0.00
                }
            )
            if not created:
                free_plan.plan_duartion = settings.FREE_PLAN_DURATION_DAYS
                free_plan.max_url_storage = settings.FREE_PLAN_URL_LIMIT
                free_plan.price = 0.00
                free_plan.save()
                self.stdout.write(self.style.SUCCESS("FREE plan updated successfully."))
            else:
                self.stdout.write(self.style.SUCCESS("FREE plan created successfully."))

            # Create or update PREMIUM plan
            premium_url_limit = -1 if settings.PREMIUM_PLAN_UNLIMITED else settings.PAID_PLAN_URL_LIMIT
            premium_plan, created = SubscriptionPlan.objects.get_or_create(
                plan="PREMIUM",
                defaults={
                    "plan_duartion": settings.PAID_PLAN_DURATION_DAYS,
                    "max_url_storage": premium_url_limit,
                    "price": settings.PAID_PLAN_PRICE
                }
            )
            if not created:
                premium_plan.plan_duartion = settings.PAID_PLAN_DURATION_DAYS
                premium_plan.max_url_storage = premium_url_limit
                premium_plan.price = settings.PAID_PLAN_PRICE
                premium_plan.save()
                self.stdout.write(self.style.SUCCESS("PREMIUM plan updated successfully."))
            else:
                self.stdout.write(self.style.SUCCESS("PREMIUM plan created successfully."))

            # Display current configuration
            self.stdout.write(self.style.WARNING("\nCurrent Plan Configuration:"))
            self.stdout.write(f"FREE Plan: {free_plan.max_url_storage} URLs, {free_plan.plan_duartion} days, ${free_plan.price}")
            unlimited_text = "Unlimited" if premium_url_limit == -1 else str(premium_url_limit)
            self.stdout.write(f"PREMIUM Plan: {unlimited_text} URLs, {premium_plan.plan_duartion} days, ${premium_plan.price}")
            
        except Exception as e:
            self.stdout.write(self.style.ERROR(f"Error syncing plans: {e}"))