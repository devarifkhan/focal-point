#!/usr/bin/env python
import os
import django

# Setup Django
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'productivity_plugin_api.settings')
django.setup()

from django_celery_beat.models import PeriodicTask
import json

# Delete all duplicate tasks
tasks = PeriodicTask.objects.filter(task="urlshandler.tasks.reset_user_urls")
print(f"Found {tasks.count()} total tasks")

# Group by user_id and keep only one per user
user_tasks = {}
for task in tasks:
    try:
        user_id = json.loads(task.args)[0]
        if user_id not in user_tasks:
            user_tasks[user_id] = []
        user_tasks[user_id].append(task)
    except:
        # Delete malformed tasks
        task.delete()
        print(f"Deleted malformed task: {task.name}")

# Keep only the latest task for each user
deleted_count = 0
for user_id, task_list in user_tasks.items():
    if len(task_list) > 1:
        # Sort by ID and keep the latest
        task_list.sort(key=lambda x: x.id)
        for task in task_list[:-1]:
            print(f"Deleting duplicate task: {task.name}")
            task.delete()
            deleted_count += 1

print(f"Deleted {deleted_count} duplicate tasks")
print(f"Remaining tasks: {PeriodicTask.objects.filter(task='urlshandler.tasks.reset_user_urls').count()}")