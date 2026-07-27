from django.core.management.base import BaseCommand
from urlshandler.models import Urls


class Command(BaseCommand):
    def handle(self, *args, **kwargs):
        try:
            urls = Urls.objects.all()
            if urls.exists():
                for url in urls:
                    # Update all fields to their default values
                    url.visited = False
                    url.half_time_notified = False
                    url.one_quarter_notified = False
                    url.three_quarter_notified = False
                    url.used_time=0.0
                    url.edit = False
                    url.temporary_time = 0
                    url.save()

                    # Display the updated values
                    self.stdout.write(self.style.SUCCESS(
                        f"Updated URL ID: {url.id}\n"
                        f"Visited: {url.visited}\n"
                        f"Half Time Notified: {url.half_time_notified}\n"
                        f"One Quarter Notified: {url.one_quarter_notified}\n"
                        f"Three Quarter Notified: {url.three_quarter_notified}\n"
                        f"Default Time: {url.default_time}\n"
                        f"Edit: {url.edit}\n"
                        f"Used Time: {url.used_time}\n"
                        f"Is Temporary: {url.is_temporary}\n"
                        f"Temporary Time: {url.temporary_time}\n"
                        f"------------------------"
                    ))
            else:
                self.stdout.write(self.style.WARNING("No URLs found in database"))
        except Exception as e:
            self.stdout.write(self.style.ERROR(f"Error updating URLs: {e}"))
