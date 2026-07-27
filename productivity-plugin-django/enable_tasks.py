#!/usr/bin/env python
import os
import django

# Setup Django
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'productivity_plugin_api.settings')
django.setup()

from django_celery_beat.models import PeriodicTask

# Re-enable all tasks
tasks = PeriodicTask.objects.filter(task="urlshandler.tasks.reset_user_urls")
print(f"Found {tasks.count()} tasks to enable")

for task in tasks:
    task.enabled = True
    task.save()
    print(f"Enabled task: {task.name}")

print("All tasks enabled successfully!")