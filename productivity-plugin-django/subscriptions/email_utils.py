from django.core.mail import send_mail
from django.template.loader import render_to_string
from django.conf import settings
from django.utils import timezone

def send_payment_email(user, payment, status):
    """Send payment notification email to user"""
    try:
        user_name = f"{user.first_name} {user.last_name}".strip() or user.email
        
        context = {
            'user_name': user_name,
            'transaction_id': payment.transaction_id,
            'amount': payment.amount,
            'currency': 'USD',
            'payment_date': timezone.now().strftime('%B %d, %Y at %I:%M %p'),
            'status': status
        }
        
        subject = f"Payment {'Successful - Welcome to Focusly Premium!' if status == 'SUCCESS' else 'Failed - Focusly'}"
        
        html_message = render_to_string('payment_notification_email.html', context)
        
        send_mail(
            subject=subject,
            message='',
            from_email=settings.DEFAULT_FROM_EMAIL,
            recipient_list=[user.email],
            html_message=html_message,
            fail_silently=False
        )
        
        return True
    except Exception as e:
        print(f"Failed to send payment email: {str(e)}")
        return False