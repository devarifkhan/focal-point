import os
from celery import Celery
from django.conf import settings
import pytz
from datetime import datetime, timedelta
from dotenv import load_dotenv
from pathlib import Path

# Load environment variables from .env file
BASE_DIR = Path(__file__).resolve().parent.parent
load_dotenv(dotenv_path=os.path.join(BASE_DIR, ".env"))

# Set the default Django settings module for the 'celery' program.
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'productivity_plugin_api.settings')

app = Celery('productivity_plugin_api')

# Using a string here means the worker doesn't have to serialize
# the configuration object to child processes.
app.config_from_object('django.conf:settings', namespace='CELERY')

# Disable UTC for Celery (using Asia/Dhaka timezone)
app.conf.enable_utc = False

# Set timezone for Celery Beat
app.conf.timezone = 'Asia/Dhaka'

# Get Redis and queue configuration from environment
REDIS_HOST = os.environ.get('REDIS_HOST', 'localhost')
REDIS_PORT = os.environ.get('REDIS_PORT', '6379')
REDIS_DB = os.environ.get('REDIS_DB', '0')
CELERY_QUEUE_NAME = os.environ.get('CELERY_QUEUE_NAME', 'default')

# Build Redis URLs
REDIS_URL = f'redis://{REDIS_HOST}:{REDIS_PORT}/{REDIS_DB}'
CELERY_BROKER_URL = os.environ.get('CELERY_BROKER_URL', REDIS_URL)
CELERY_RESULT_BACKEND = os.environ.get('CELERY_RESULT_BACKEND', REDIS_URL)

print(f"REDIS_HOST: {REDIS_HOST}")
print(f"REDIS_PORT: {REDIS_PORT}")
print(f"REDIS_DB: {REDIS_DB}")
print(f"CELERY_QUEUE_NAME: {CELERY_QUEUE_NAME}")
print(f"CELERY_BROKER_URL: {CELERY_BROKER_URL}")
print(f"CELERY_RESULT_BACKEND: {CELERY_RESULT_BACKEND}")

# Configure Celery with environment-based settings
app.conf.update(
    broker_url=CELERY_BROKER_URL,
    result_backend=CELERY_RESULT_BACKEND,
    worker_max_tasks_per_child=1000,
    task_time_limit=120,  # 2 minutes
    task_soft_time_limit=110,  # 1 minute 50 seconds
    task_acks_late=True,
    worker_prefetch_multiplier=1,
    task_serializer='json',
    accept_content=['json'],
    result_serializer='json',
    worker_log_color=False,
    beat_max_loop_interval=10,  # Check for scheduled tasks every 10 seconds
    task_routes={
        'urlshandler.tasks.*': {'queue': CELERY_QUEUE_NAME},
    },
    task_default_queue=CELERY_QUEUE_NAME,
)

# Load task modules from all registered Django apps.
app.autodiscover_tasks()

@app.task(bind=True, ignore_result=True)
def debug_task(self):
    print(f'Request: {self.request!r}')