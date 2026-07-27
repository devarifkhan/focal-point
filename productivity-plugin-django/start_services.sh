#!/bin/bash

# Start services script for production deployment
set -e

echo "Starting productivity plugin services..."

# Activate virtual environment
echo "Activating virtual environment..."
source venv/bin/activate

# Create logs directory
mkdir -p logs

# Kill existing processes (only owned by current user)
echo "Stopping existing services..."
pkill -u $(whoami) -f "celery -A productivity_plugin_api" 2>/dev/null || true
pkill -u $(whoami) -f "daphne" 2>/dev/null || true
sleep 2

# Clean up tasks
echo "Cleaning up duplicate tasks..."
python delete_all_tasks.py

# Start Celery worker
echo "Starting Celery worker..."
nohup celery -A productivity_plugin_api worker -l INFO -Q productivity_queue > logs/celery_worker.log 2>&1 &
CELERY_WORKER_PID=$!
echo $CELERY_WORKER_PID > celery_worker.pid

# Start Celery beat
echo "Starting Celery beat..."
nohup celery -A productivity_plugin_api beat -l INFO --scheduler django_celery_beat.schedulers:DatabaseScheduler > logs/celery_beat.log 2>&1 &
CELERY_BEAT_PID=$!
echo $CELERY_BEAT_PID > celery_beat.pid

# Start Daphne
echo "Starting Daphne server..."
nohup daphne -b 0.0.0.0 -p 8096 productivity_plugin_api.asgi:application > logs/daphne.log 2>&1 &
DAPHNE_PID=$!
echo $DAPHNE_PID > daphne.pid

# Wait a moment for services to start
sleep 5

# Verify services
echo "Verifying services..."
echo "Celery processes:"
ps aux | grep celery | grep -v grep || echo "No Celery processes found"

echo "Daphne processes:"
ps aux | grep daphne | grep -v grep || echo "No Daphne processes found"

echo "Port 8096 status:"
netstat -tlnp | grep :8096 || echo "Port 8096 not listening"

echo "Recent Daphne logs:"
tail -n 10 logs/daphne.log

echo "Services started successfully!"
echo "PIDs saved to: celery_worker.pid, celery_beat.pid, daphne.pid"