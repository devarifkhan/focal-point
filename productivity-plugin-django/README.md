# Productivity Plugin Django Backend

A Django-based backend for the productivity plugin that blocks distracting sites.

## Environment Setup

### Initial Setup

1. Clone the repository:
```bash
git clone <repository-url>
cd productivity-plugin-django
```

2. Create and activate a virtual environment:
```bash
python3 -m venv venv
source venv/bin/activate
```

3. Install dependencies:
```bash
pip install --upgrade pip
pip install -r requirements.txt
```

4. Set the application environment:
```bash
export APP_ENV=local  # Options: local, development, staging, production
```

5. Configure your database in `productivity_plugin_api/settings.py` or use environment variables:
```bash
export DB_NAME=productivitydb
export DB_USER=productivityplugin
export DB_PASSWORD=Productivityplugin1#
export DB_HOST=127.0.0.1
export DB_PORT=3306
```

6. Configure plan settings (optional):
```bash
export FREE_PLAN_URL_LIMIT=3
export FREE_PLAN_DURATION_DAYS=7
export PAID_PLAN_URL_LIMIT=50
export PREMIUM_PLAN_UNLIMITED=true  # Set to false to use PAID_PLAN_URL_LIMIT for PREMIUM plan
export PAID_PLAN_DURATION_DAYS=30
export PAID_PLAN_PRICE=9.99
```

7. Configure Celery and Redis settings (optional):
```bash
export REDIS_HOST=localhost          # Default: 'localhost'
export REDIS_PORT=6379              # Default: '6379'
export REDIS_DB=0                   # Default: '0'
export CELERY_QUEUE_NAME=productivity_queue  # Default: 'default'
# Or use full URLs (overrides individual settings above)
export CELERY_BROKER_URL=redis://localhost:6379/0
export CELERY_RESULT_BACKEND=redis://localhost:6379/0
```

8. Run migrations:
```bash
python manage.py migrate
```

9. Sync subscription plans with environment variables:
```bash
python manage.py sync_plans
```

**Note:** The `sync_plans` command will create/update subscription plans based on your environment variables. PREMIUM plan will have unlimited URLs when `PREMIUM_PLAN_UNLIMITED=true` (default), or use `PAID_PLAN_URL_LIMIT` when set to `false`.

10. Create a superuser (optional):
```bash
python manage.py createsuperuser
```

### Running the Server

**For WebSocket support (recommended):**
```bash
daphne -p 8000 productivity_plugin_api.asgi:application
```

**For HTTP-only (legacy):**
```bash
python manage.py runserver
```

**For production:**
```bash
# With WebSocket support
daphne -b 0.0.0.0 -p 8000 productivity_plugin_api.asgi:application

# HTTP-only with Gunicorn
gunicorn productivity_plugin_api.wsgi:application --bind 0.0.0.0:8000 --workers 3
```

## Features

- URL blocking and management
- User authentication and management
- Timezone-aware scheduling
- Automatic URL reset at specified times
- Flexible subscription plans with unlimited URLs for PREMIUM users

## Timezone Support and Scheduling

The application supports timezone-aware scheduling for URL reset operations:

1. Each user has a timezone field that defaults to UTC
2. URLs are reset daily at 5:35 PM in the user's local timezone
3. Users can update their timezone through the API
4. Timezone can be set during URL creation or update
5. Celery Beat checks for scheduled tasks every 10 seconds

## Celery Integration

The application uses Celery for task scheduling:

1. The `reset_user_urls` task resets all URLs for a specific user
2. The `schedule_reset_for_user` task schedules URL reset at 5:35 PM in user's timezone
3. The `schedule_resets_for_all_users` task schedules resets for all users
4. Tasks are automatically created when users add URLs and cleaned up to prevent duplicates

### Setting Up Redis (Celery Broker)

Ensure Redis is installed and running:
```bash
# Install Redis on Ubuntu
sudo apt-get update
sudo apt-get install redis-server

# Check if Redis is running
redis-cli ping  # Should return PONG
```

### Running Celery

Run the Celery worker and beat scheduler:

```bash
# Start Celery worker (with specific queue if configured)
celery -A productivity_plugin_api worker -l info -Q productivity_queue

# Start Celery beat scheduler
celery -A productivity_plugin_api beat -l info --scheduler django_celery_beat.schedulers:DatabaseScheduler
```

Or use the provided script:

```bash
./run_celery.sh
```

### Running Celery in Background (Production)

To run Celery in the background:

```bash
# Create logs directory
mkdir -p logs

# Clean up any existing duplicate tasks (IMPORTANT)
python delete_all_tasks.py

# Stop any existing Celery processes
pkill -f "celery -A productivity_plugin_api"

# Start Celery worker in background (with queue)
nohup celery -A productivity_plugin_api worker -l INFO -Q productivity_queue > logs/celery_worker.log 2>&1 &

# Start Celery beat in background (with 10-second check interval)
nohup celery -A productivity_plugin_api beat -l INFO --scheduler django_celery_beat.schedulers:DatabaseScheduler > logs/celery_beat.log 2>&1 &
```

### Verifying Celery is Running

```bash
# Check Celery processes
ps aux | grep celery

# Check scheduled tasks
python manage.py shell -c "from django_celery_beat.models import PeriodicTask; print(f'Total scheduled tasks: {PeriodicTask.objects.filter(task=\"urlshandler.tasks.reset_user_urls\").count()}'); print('Tasks by timezone:'); from collections import Counter; print(Counter([str(pt.crontab.timezone) for pt in PeriodicTask.objects.filter(crontab__isnull=False)]))"

# Monitor logs for issues
tail -f logs/celery_worker.log
tail -f logs/celery_beat.log
```

## Plan Configuration

The application supports flexible subscription plans:

### FREE Plan
- Limited URLs (configurable via `FREE_PLAN_URL_LIMIT`)
- Limited duration (configurable via `FREE_PLAN_DURATION_DAYS`)
- Free of charge

### PREMIUM Plan
- **Unlimited URLs by default** (when `PREMIUM_PLAN_UNLIMITED=true`)
- Or limited URLs (when `PREMIUM_PLAN_UNLIMITED=false`, uses `PAID_PLAN_URL_LIMIT`)
- Extended duration (configurable via `PAID_PLAN_DURATION_DAYS`)
- Paid subscription (configurable via `PAID_PLAN_PRICE`)

### Environment Variables
- `PREMIUM_PLAN_UNLIMITED=true` (default): PREMIUM plan has unlimited URLs
- `PREMIUM_PLAN_UNLIMITED=false`: PREMIUM plan uses `PAID_PLAN_URL_LIMIT`
- API responses return `-1` for unlimited URL plans
- URL limit checks are bypassed for unlimited plans

## API Endpoints

### URL Management
- `POST /urlshandler/add` - Add a new URL (can include timezone)
- `GET /urlshandler/retrive_urls_list/` - List all URLs for a user
- `DELETE /urlshandler/delete_url/<id>` - Delete a URL
- `PUT /urlshandler/update_url/<id>` - Update a URL (can include timezone)
- `PUT /urlshandler/reset_time/<id>` - Reset a URL
- `PUT /urlshandler/add_calender_url/<id>` - Update calendar URL

### WebSocket Endpoints
- `ws://localhost:8000/ws/urls/list/<user_id>/` - Real-time URL list updates
- `ws://localhost:8000/ws/urls/update/<url_id>/` - Real-time URL updates

### Timezone and Schedule Management
- `GET /urlshandler/scheduled-tasks/` - View scheduled tasks
- `PUT /urlshandler/update-timezone/` - Update user timezone
- `POST /urlshandler/manual-reset/` - Manually trigger URL reset

### Plan Management
- `GET /subscriptions/plan_config` - Get current plan configuration from environment variables
- `GET /subscriptions/subscriptions_plan_list` - List all subscription plans (includes config info)

## Dependencies

- Python 3.8+
- Django 5.0.7
- Celery 5.3.6+
- Redis 5.0.1+
- django-celery-beat 2.5.0+
- Other dependencies in requirements.txt

## Deployment

### Using Makefile for Deployment

The project includes a Makefile to simplify deployment:

```bash
# Deploy to development environment
make deploy_dev

# Deploy to QA environment
make deploy_qa

# Deploy to staging environment
make deploy_stage

# Deploy to production environment
make deploy_prod
```

### Restarting Services After Deployment

After deployment, you'll need to restart services:

1. SSH into the server:
   ```bash
   ssh [username]@[server-ip]
   ```

2. Navigate to the project directory:
   ```bash
   cd /path/to/project
   ```

3. Start/restart Celery services:
   ```bash
   # If supervisor is available:
   sudo supervisorctl restart celery_dev celery_beat_dev
   
   # Without supervisor:
   source venv/bin/activate
   # Kill existing processes (if any)
   pkill -f "celery -A productivity_plugin_api"
   # Start new processes
   nohup celery -A productivity_plugin_api worker -l INFO -Q productivity_queue > logs/celery_worker.log 2>&1 &
   nohup celery -A productivity_plugin_api beat -l INFO --scheduler django_celery_beat.schedulers:DatabaseScheduler > logs/celery_beat.log 2>&1 &
   ```

4. Start/restart Daphne (WebSocket support):
   ```bash
   # If supervisor is available:
   sudo supervisorctl restart daphne_dev
   
   # Without supervisor:
   source venv/bin/activate
   # Kill existing processes (if any)
   pkill -f "daphne"
   # Start new process
   nohup daphne -b 0.0.0.0 -p 8000 productivity_plugin_api.asgi:application > logs/daphne.log 2>&1 &
   ```

5. Verify services are running:
   ```bash
   ps aux | grep celery
   ps aux | grep daphne
   ```

## Troubleshooting

### Common Issues

1. **Celery not starting**:
   - Check Redis is running: `redis-cli ping`
   - Verify your CELERY_BROKER_URL: `python -c "from productivity_plugin_api.settings import CELERY_BROKER_URL; print(CELERY_BROKER_URL)"`
   - Check Celery logs: `tail -f logs/celery_worker.log`

2. **Scheduled tasks not running**:
   - Verify Celery beat is running: `ps aux | grep "celery beat"`
   - Check beat logs: `tail -f logs/celery_beat.log`
   - Verify tasks in database: `python manage.py shell -c "from django_celery_beat.models import PeriodicTask; print(PeriodicTask.objects.filter(task='urlshandler.tasks.reset_user_urls').count())"`

3. **Tasks running too frequently (rapid execution)**:
   - **CRITICAL**: Clean up duplicate/malformed tasks: `python delete_all_tasks.py`
   - Restart Celery services after cleanup
   - Check for old tasks with bad cron schedules
   - Monitor logs to ensure tasks only run at scheduled times (5:35 PM daily)

4. **URL resets not working**:
   - Check user timezones: `python manage.py shell -c "from users.models import User; print([(user.id, user.email, user.timezone) for user in User.objects.all()])"`
   - Check URLs per user: `python manage.py shell -c "from urlshandler.models import Urls; from users.models import User; [print(f'User {user.id}: {user.email}, URLs: {Urls.objects.filter(user_id=user.id).count()}') for user in User.objects.all()]"`

### Production Deployment Checklist

1. **Clean deployment**:
   ```bash
   # Stop all Celery processes
   pkill -f "celery -A productivity_plugin_api"
   
   # Clean up old tasks
   python delete_all_tasks.py
   
   # Verify cleanup
   python manage.py shell -c "from django_celery_beat.models import PeriodicTask; print(f'Remaining tasks: {PeriodicTask.objects.filter(task=\"urlshandler.tasks.reset_user_urls\").count()}')"
   ```

2. **Start services**:
   ```bash
   # Start worker and beat
   nohup celery -A productivity_plugin_api worker -l INFO -Q productivity_queue > logs/celery_worker.log 2>&1 &
   nohup celery -A productivity_plugin_api beat -l INFO --scheduler django_celery_beat.schedulers:DatabaseScheduler > logs/celery_beat.log 2>&1 &
   ```

3. **Verify operation**:
   ```bash
   # Should show quiet operation, no rapid task execution
   tail -f logs/celery_worker.log
   ```


## Production Commands

### Clean Deployment
```bash
# Stop all processes
pkill -f "celery -A productivity_plugin_api"
pkill -f "daphne"

# Clean up duplicate tasks
python delete_all_tasks.py

# Start services
nohup celery -A productivity_plugin_api worker -l INFO -Q productivity_queue > logs/celery_worker.log 2>&1 &
nohup celery -A productivity_plugin_api beat -l INFO --scheduler django_celery_beat.schedulers:DatabaseScheduler > logs/celery_beat.log 2>&1 &
nohup daphne -b 0.0.0.0 -p 8000 productivity_plugin_api.asgi:application > logs/daphne.log 2>&1 &

# Verify
ps aux | grep celery
ps aux | grep daphne
tail -f logs/celery_worker.log

```

### Development Commands
```bash
# Restart Celery Beat (development)
celery -A productivity_plugin_api beat -l info --scheduler django_celery_beat.schedulers:DatabaseScheduler

# Restart Celery Worker in another terminal (development)
celery -A productivity_plugin_api worker -l info -Q productivity_queue
```