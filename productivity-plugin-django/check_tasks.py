#!/usr/bin/env python
import os
import django

# Setup Django
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'productivity_plugin_api.settings')
django.setup()

from django_celery_beat.models import PeriodicTask, CrontabSchedule
import json

# Check all tasks
tasks = PeriodicTask.objects.filter(task="urlshandler.tasks.reset_user_urls")
print(f"Found {tasks.count()} total tasks")

for task in tasks:
    try:
        user_id = json.loads(task.args)[0]
        cron = task.crontab
        print(f"Task: {task.name}")
        print(f"  User: {user_id}")
        print(f"  Enabled: {task.enabled}")
        print(f"  Cron: {cron.hour}:{cron.minute} {cron.day_of_week} {cron.day_of_month} {cron.month_of_year} TZ:{cron.timezone}")
        print(f"  Last run: {task.last_run_at}")
        print("---")
    except Exception as e:
        print(f"Error with task {task.name}: {e}")

# Disable all tasks temporarily
print("\nDisabling all tasks...")
tasks.update(enabled=False)
print("All tasks disabled")