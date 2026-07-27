from rest_framework import status
from users.models import User
from django.conf import settings
from users.models import VerificationCode, User
from django.core.mail import send_mail
import random
import jwt
from datetime import timedelta
from django.utils import timezone
import requests


# Use Django's settings.SECRET_KEY instead of hardcoding
SECRET_KEY = settings.SECRET_KEY
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 525600 

def create_access_token(data:dict):
    encode_data = data.copy()
    expire_time = timezone.now() + timedelta(minutes=int(ACCESS_TOKEN_EXPIRE_MINUTES))
    # Add required claims for SimpleJWT compatibility
    encode_data.update({
        'exp': expire_time,
        'token_type': 'access',  # Required by SimpleJWT
        'jti': str(random.getrandbits(64)),  # Add a unique JWT ID
    })
    access_token = jwt.encode(encode_data, SECRET_KEY, ALGORITHM)
    return access_token

def decode_token(token):
    try:
        data = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        return data
    except jwt.ExpiredSignatureError as e:
        print("Token has expired:", e)
        return False
    except jwt.InvalidTokenError as e:
        print("Invalid token:", e)
        return False


def get_timezone_from_ip(ip_address):
    """
    Get timezone from IP address using a free geolocation API.
    Returns timezone string (e.g., 'Asia/Dhaka', 'America/New_York', 'UTC') or 'Asia/Dhaka' if detection fails.
    """
    try:
        # Use ipapi.co as it provides timezone information without requiring an API key
        response = requests.get(f'https://ipapi.co/{ip_address}/json/')
        data = response.json()
        
        # Check if the response contains timezone information
        if 'timezone' in data and data['timezone']:
            return data['timezone']
        return 'Asia/Dhaka'  # Default fallback
    except Exception as e:
        print(f"Error detecting timezone from IP: {e}")
        return 'Asia/Dhaka'  # Default fallback


def get_client_ip(request):
    """
    Get the client's IP address from the request.
    Handles cases where the request might be behind a proxy.
    """
    x_forwarded_for = request.META.get('HTTP_X_FORWARDED_FOR')
    if x_forwarded_for:
        # X-Forwarded-For can be a comma-separated list of IPs.
        # The client's IP is the first one in the list.
        ip = x_forwarded_for.split(',')[0].strip()
    else:
        ip = request.META.get('REMOTE_ADDR')
    return ip


def generate_otp():
    """ Generate a 6-digit OTP """
    return str(random.randint(100000, 999999))


def send_verification_email(user):
    """ Generate OTP, save it, and send via email """
    from django.template.loader import render_to_string

    otp = generate_otp()
    expires_at = timezone.now() + timedelta(minutes=10)  # OTP valid for 10 minutes

    # Delete any existing OTP for this user
    VerificationCode.objects.filter(user=user).delete()

    # Store new OTP
    VerificationCode.objects.create(user=user, code=otp, expires_at=expires_at)

    subject = "Your Focusly Verification Code"
    
    # Render HTML template
    context = {
        'user': user,
        'otp_code': otp
    }
    html_message = render_to_string('otp_verification_email.html', context)
    
    # Plain text fallback
    plain_message = f"Hello {user.first_name},\n\nYour Focusly verification code is: {otp}\n\nThis code will expire in 10 minutes.\n\nIf you didn't request this code, please ignore this email."

    send_mail(
        subject,
        plain_message,
        settings.DEFAULT_FROM_EMAIL,
        [user.email],
        html_message=html_message,
        fail_silently=False,
    )

    return True


def get_authenticated_user(request, base_controller):
    """
    Extracts JWT token from request headers, decodes it, and fetches the user.
    Returns user object if successful, otherwise returns an error response.
    """
    # Extract Authorization Header
    auth_header = request.headers.get("Authorization")
    if not auth_header or "Bearer " not in auth_header:
        return base_controller.error_res(
            code="HEADER_MISSING_OR_MALFORMED",
            status_code=status.HTTP_400_BAD_REQUEST,
            error="Authorization Header Missing",
            message="Authorization Header Missing or Malformed",
        )

    # Extract Token & Decode
    token = auth_header.split("Bearer ")[1]
    user_info = decode_token(token)
    if user_info is False:
        return base_controller.error_res(
            code="TOKEN_EXPIRED",
            status_code=status.HTTP_400_BAD_REQUEST,
            error="Token Expired",
            message="Session Expired. Please login again.",
        )

    # Fetch User from Decoded Token
    try:
        user = User.objects.get(id=user_info["id"])
        return user
    except User.DoesNotExist:
        return base_controller.error_res(
            code="USER_NOT_FOUND",
            status_code=status.HTTP_404_NOT_FOUND,
            error="User Not Found",
            message="No account found with this token.",
        )
