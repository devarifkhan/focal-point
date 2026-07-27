# Makefile for Productivity Plugin with timezone-based URL reset feature
# Usage: make deploy_dev

# Define variables for server and deployment paths
DEV_SERVER = focusly_devapi@13.213.186.11
DEV_PATH = /home/focusly_devapi/htdocs/devapi.focusly.pro
DEV_URL = https://devapi.focusly.pro

# Common exclusion patterns for zip files
ZIP_EXCLUDE = -x "*.pyc" -x "*__pycache__*" -x "*.idea*" -x "*venv*" -x "*.env" -x "*.git*" -x "*.zip"

# Check for pending migrations (used by deployment targets)
check_migrations:
	@echo "Checking for pending migrations..."
	@if python manage.py showmigrations | grep -q '\[ \]'; then \
		echo "WARNING: You have pending migrations. Consider running them locally first."; \
		read -p "Continue anyway? (y/n): " answer; \
		if [ "$$answer" != "y" ] && [ "$$answer" != "Y" ]; then \
			echo "Deployment cancelled."; \
			exit 1; \
		fi; \
	else \
		echo "No pending migrations found."; \
	fi

# Create zip file for development environment
create_dev_zip:
	@echo "Creating Development zip file..."
	@zip -r dev.zip . $(ZIP_EXCLUDE)
	@echo "Development zip file created successfully!"

# Deployment target for development environment
deploy_dev: check_migrations create_dev_zip
	@echo "Deploying to development server..."
	scp dev.zip $(DEV_SERVER):$(DEV_PATH)/
	ssh $(DEV_SERVER) 'cd $(DEV_PATH) && \
		source venv/bin/activate && \
		export APP_ENV=development && \
		echo "Unzipping deployment package..." && \
		unzip -o dev.zip && \
		echo "Installing/updating dependencies..." && \
		pip install --upgrade pip && \
		pip install celery django-celery-beat pytz requests && \
		pip install -r requirements.txt && \
		echo "Collecting static files..." && \
		python manage.py collectstatic --noinput && \
		echo "Starting services using dedicated script..." && \
		chmod +x start_services.sh && \
		./start_services.sh \
	'
	@rm dev.zip
	@echo "Development deployment completed successfully!"
	@echo "Access the application at: $(DEV_URL)"
	@echo "Services have been automatically restarted:"
	@echo "✓ Celery worker and beat services"
	@echo "✓ Daphne WebSocket server"
	@echo "✓ Duplicate tasks cleaned up"
	@echo "Monitor logs: tail -f logs/celery_worker.log"





# Additional helper targets for timezone feature testing
test_timezone_detection:
	@echo "Testing timezone detection feature..."
	@source venv/bin/activate && \
	python -c "from users.utils import get_timezone_from_ip; print(f'Test IP timezone detection: {get_timezone_from_ip(\"8.8.8.8\")}')"

check_tasks:
	@echo "Checking scheduled tasks in database..."
	@source venv/bin/activate && \
	python -c "from django_celery_beat.models import PeriodicTask; print(f'Total scheduled tasks: {PeriodicTask.objects.count()}'); print('Tasks by timezone:'); from collections import Counter; print(Counter([str(pt.crontab.timezone) for pt in PeriodicTask.objects.filter(crontab__isnull=False)]))"

# Help target
help:
	@echo "Available targets:"
	@echo "  make deploy_dev    - Deploy to development server ($(DEV_URL))"
	@echo "  make test_timezone_detection - Test timezone detection feature"
	@echo "  make check_tasks   - Check scheduled tasks in database"
	@echo "  make help          - Show this help message"

.PHONY: check_migrations create_dev_zip deploy_dev \
        test_timezone_detection check_tasks help