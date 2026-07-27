from django.urls import path
from users.views import ChangePassword, Register, Login, ForgetPassword, render_template, confirm_reset_password, VerifyEmail, ResendOTP, GetPlanConfig

urlpatterns = [
    path('register', Register.as_view(), name='register'),
    path('login', Login.as_view(), name='login'),
    path('change_password', ChangePassword.as_view(), name='change_password'),
    path('forget_password', ForgetPassword.as_view(), name='forget_password'),
    path('reset_password/', render_template, name='reset_password'),
    path('confirm_reset_password', confirm_reset_password,
         name='confirm_password_change'),
  
    path('verify_email', VerifyEmail.as_view(), name='verify_email'),
    path('resend_otp', ResendOTP.as_view(), name='resend_otp'),
    path('plan_config', GetPlanConfig.as_view(), name='plan_config'),
]
 