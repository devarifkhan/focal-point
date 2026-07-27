from django.db import models
from django.utils import timezone
from users.models import User

class Urls(models.Model):
    user_id = models.ForeignKey(User, on_delete=models.CASCADE)
    block_urls = models.CharField('block_urls',max_length=250,null=True)
    redirect_urls = models.CharField('redirect_urls',max_length=250,null=True,blank=True)

    is_active = models.BooleanField('is_active', default=True)
    visited = models.BooleanField('visited', default=False)
    used_time = models.FloatField('used_time', default=0.0)
    half_time_notified = models.BooleanField('half_time_notified', default=False)
    one_quarter_notified = models.BooleanField('one_quarter_notified', default=False)
    three_quarter_notified = models.BooleanField('three_quarter_notified', default=False)
    is_temporary = models.BooleanField('is_temporary', default=False)
    default_time=models.IntegerField('default_time', default=0)
    calender_url=models.CharField('calender_url',max_length=250,null=True)
    message=models.CharField('message',max_length=250,null=True)
    edit=models.BooleanField('edit',default=False)
    image = models.ImageField('image', upload_to='images/', null=True, blank=True)  # New field for storing images
    temporary_time = models.IntegerField('temporary_time', null=True, blank=True)  # New field for storing temporary time
    today_limit = models.IntegerField('today_limit', default=0)
    created_at = models.DateTimeField('created_at', default=timezone.now)
    updated_at = models.DateTimeField('updated_at', auto_now=True)

    def __str__(self) -> str:
        return f"{self.block_urls} will be redirected to {self.redirect_urls}"