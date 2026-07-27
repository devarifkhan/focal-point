from django.apps import AppConfig


class UrlshandlerConfig(AppConfig):
    default_auto_field = 'django.db.models.BigAutoField'
    name = 'urlshandler'
    
    def ready(self):
        """Register signal handlers when the app is ready."""
        import urlshandler.signals  # Import the signals module
