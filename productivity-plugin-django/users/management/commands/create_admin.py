from django.core.management.base import BaseCommand
from users.models import User
from subscriptions.models import SubscriptionPlan, Subscriptions
from django.utils import timezone
from datetime import timedelta


class Command(BaseCommand):
    help = 'Create admin user'

    def handle(self, *args, **options):
        # Create admin user
        admin_email = "admin@focusly.pro"
        
        # Check if admin already exists
        if User.objects.filter(email=admin_email).exists():
            admin_user = User.objects.get(email=admin_email)
            admin_user.role = "ADMIN"
            admin_user.is_staff = True
            admin_user.save()
            self.stdout.write(
                self.style.WARNING(f'Admin user {admin_email} already exists - updated to ADMIN role')
            )
        else:
            admin_user = User.objects.create_user(
                email=admin_email,
                password="admin123",
                first_name="Admin",
                last_name="User",
                role="ADMIN",
                is_active=True,
                is_verified=True,
                is_staff=True
            )
        
        # Create admin subscription (paid plan)
        try:
            paid_plan = SubscriptionPlan.objects.get(plan='PAID')
        except SubscriptionPlan.DoesNotExist:
            paid_plan = SubscriptionPlan.objects.create(
                plan='PAID',
                plan_duartion=365,
                max_url_storage=999,
                price=0
            )
        
        # Update or create subscription
        subscription, created = Subscriptions.objects.update_or_create(
            user=admin_user,
            defaults={
                'sub_plan': paid_plan,
                'subcription_end_at': timezone.now() + timedelta(days=365)
            }
        )
        
        action = "created" if not User.objects.filter(email=admin_email, role="ADMIN").exists() else "updated"
        self.stdout.write(
            self.style.SUCCESS(
                f'Admin user {action} successfully:\n'
                f'Email: {admin_email}\n'
                f'Password: admin123\n'
                f'Role: ADMIN'
            )
        )