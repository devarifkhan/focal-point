#!/bin/bash
# Start Celery Worker
celery -A productivity_plugin_api worker -l info &

# Start Celery Beat
celery -A productivity_plugin_api beat -l info --scheduler django_celery_beat.schedulers:DatabaseScheduler &

# Keep script running
echo "Celery Worker and Beat are running. Press CTRL+C to stop."
tail -f /dev/null
