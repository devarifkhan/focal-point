from django.db import models
from users.models import User


class UserActivity(models.Model):
    user = models.ForeignKey(User, on_delete=models.CASCADE)
    date = models.DateField(auto_now_add=True)
    urls_blocked = models.IntegerField(default=0)
    time_saved_minutes = models.FloatField(default=0.0)
    sites_visited = models.IntegerField(default=0)
    
    class Meta:
        unique_together = ['user', 'date']
    
    def __str__(self):
        return f"{self.user.email} - {self.date}"