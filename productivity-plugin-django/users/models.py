import datetime
from django.utils import timezone
from django.db import models
from django.contrib.auth.base_user import AbstractBaseUser
from django.contrib.auth.models import PermissionsMixin
from users.manager import UserManager

class User(AbstractBaseUser,PermissionsMixin):
    ROLE_CHOICES = [
        ('USER', 'User'),
        ('ADMIN', 'Admin'),
    ]
    
    first_name = models.CharField('first_name',max_length=100,blank=False,null=False)
    last_name = models.CharField('last_name',max_length=100, blank=False,null= False)
    email = models.EmailField('email',blank=False,null=False,unique=True)
    phone_number = models.CharField('phone_number', max_length=20, blank=True, null=True)
    role = models.CharField('role', max_length=10, choices=ROLE_CHOICES, default='USER')
    is_staff = models.BooleanField(
        'staff status',
        default=False,
        help_text='Designates whether the user can log into this admin site.',
    )
    is_active = models.BooleanField(
        'active',
        default=False,
        help_text='Designates whether this user should be treated as active. Unselect this instead of deleting accounts.'
    )
    is_verified = models.BooleanField(default=False)
    date_joined = models.DateTimeField('date joined', auto_now=True)
    total_url_stored = models.IntegerField('total_url_stored', blank=True,null=True,default=0)
    passowrd_request_valid = models.BooleanField('is_passowrd_changed',default=False)
    timezone = models.CharField('timezone', max_length=50, default='Asia/Dhaka', help_text='User timezone for scheduling')
    
    def is_admin(self):
        return self.role == 'ADMIN'

    objects = UserManager()
    
    USERNAME_FIELD = 'email'

    class Meta:
        db_table = 'user'
        verbose_name = 'User'
        verbose_name_plural = 'Users'

    def __str__(self):
        return f"{self.first_name} {self.last_name}"
    



class VerificationCode(models.Model):
    user = models.OneToOneField(User, on_delete=models.CASCADE)
    code = models.CharField(max_length=6)
    expires_at = models.DateTimeField()

    def is_expired(self):
        return timezone.now() > self.expires_at
