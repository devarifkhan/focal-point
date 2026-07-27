from django.db import models
from users.models import User
from datetime import datetime

class Payment(models.Model):
    PAYMENT_STATUS_CHOICES = [
        ('PENDING', 'Pending'),
        ('SUCCESS', 'Success'),
        ('FAILED', 'Failed'),
        ('CANCELLED', 'Cancelled'),
    ]
    
    user = models.ForeignKey(User, on_delete=models.CASCADE)
    transaction_id = models.CharField(max_length=100, unique=True)
    amount = models.DecimalField(max_digits=10, decimal_places=2)
    currency = models.CharField(max_length=3, default='BDT')
    status = models.CharField(max_length=20, choices=PAYMENT_STATUS_CHOICES, default='PENDING')
    sslcommerz_session_id = models.CharField(max_length=100, blank=True, null=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    def __str__(self):
        return f"{self.user.email} - {self.transaction_id} - {self.status}"

class SubscriptionPlan(models.Model):

    plan = models.CharField(max_length=20,null=False,blank=False,unique=True)
    plan_duartion = models.IntegerField(null=False,blank=False,default=7)
    max_url_storage = models.IntegerField(null=False,blank=False,default=3)
    price = models.FloatField(null=False,blank=False,default=0)

    def __str__(self):
        return f"Plan Type {self.plan}"


class Subscriptions(models.Model):
    sub_plan = models.ForeignKey(SubscriptionPlan,on_delete=models.CASCADE)
    user = models.OneToOneField(User,on_delete=models.CASCADE)
    subcription_start_at = models.DateTimeField(blank=False,null=False,auto_now_add=True)
    subcription_end_at = models.DateTimeField(blank=False,null=False)
    def __str__(self):
        return f"{self.user.first_name} is subscribed to {self.sub_plan.plan}"
    