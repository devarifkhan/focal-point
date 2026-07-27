#!/usr/bin/env python
import os
import django

# Setup Django
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'productivity_plugin_api.settings')
django.setup()

from django_celery_beat.models import PeriodicTask

# Delete all reset tasks
tasks = PeriodicTask.objects.filter(task="urlshandler.tasks.reset_user_urls")
count = tasks.count()
tasks.delete()
print(f"Deleted {count} tasks")
print("All tasks cleared")