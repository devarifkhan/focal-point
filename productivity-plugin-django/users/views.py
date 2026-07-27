from django.core.cache import cache  # To implement rate limiting
from users.utils import get_authenticated_user
from datetime import timezone
from users.models import VerificationCode, User
from rest_framework import status, serializers
# Assuming your base response handling class
from classes.base_controler import BaseController
from users.utils import send_verification_email, decode_token
from rest_framework import status
from users.utils import send_verification_email
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from django.http import JsonResponse, Http404
from django.core.exceptions import ValidationError
from django.shortcuts import render
from django.template.loader import render_to_string
from rest_framework.permissions import AllowAny
from rest_framework.views import APIView
from post_office import mail
from django.conf import settings
from productivity_plugin_api.settings import DEFAULT_FROM_EMAIL
from classes.base_controler import BaseController
from django.utils import timezone
from datetime import timedelta
from users.models import User
from subscriptions.models import Subscriptions, SubscriptionPlan
from urlshandler.models import Urls
from users.serializers import (
    RegisterSerializer,
    LoginSerializer,
    ChangePasswordSerializer,
    ForgetPassWordSerializer,
    UserSerializer,
    VerifyEmailSerializer
)
from users.utils import (
    create_access_token,
    decode_token,
)

from django.http import JsonResponse, Http404
from django.core.exceptions import ValidationError
from users.models import User
from users.utils import decode_token
from rest_framework import serializers


# class Register(APIView, BaseController):
#     permission_classes = (AllowAny,)

#     def post(self, request):
#         try:
#             serialized_data = RegisterSerializer(data=request.data)

#             try:
#                 serialized_data.is_valid(raise_exception=True)
#                 user = serialized_data.save()

#                 user_data = UserSerializer(user).data
#                 return super().success_res(
#                     code="SUCCESS",
#                     status_code=201,
#                     data={
#                         "user_data": user_data,
#                         "message": "Registration successful. Free subscription activated.",
#                     },
#                 )
#             except serializers.ValidationError as e:
#                 errors = e.detail
#                 error_message = "Validation error occurred"

#                 # Check email error first
#                 if "email" in errors:
#                     email_error = errors["email"][0]
#                     if "unique" in str(email_error).lower():
#                         error_message = "This email address is already registered"
#                     else:
#                         error_message = str(email_error)
#                 # Check password error only if no email error
#                 elif "password" in errors:
#                     error_message = str(errors["password"][0])

#                 return super().error_res(
#                     code="VALIDATION_ERROR",
#                     error=error_message,
#                     message="Failed to register user. Please try again.",
#                     status_code=400,
#                 )

#         except Exception as e:
#             return super().error_res(
#                 code="TRY_AGAIN",
#                 error=str(e),
#                 message="Failed to register user. Please try again.",
#                 status_code=500,
#             )


class Register(APIView, BaseController):
    permission_classes = (AllowAny,)

    def post(self, request):
        try:
            serialized_data = RegisterSerializer(data=request.data)

            try:
                serialized_data.is_valid(raise_exception=True)
                user = serialized_data.save()

                # Send OTP via email
                send_verification_email(user)

                user_data = UserSerializer(user).data
                return self.success_res(
                    code="SUCCESS",
                    status_code=201,
                    data={
                        "user_data": user_data,
                        "message": "Registration successful. A verification code has been sent to your email.",
                    },
                )
            except serializers.ValidationError as e:
                errors = e.detail
                error_message = "Validation error occurred"

                if "email" in errors:
                    email_error = errors["email"][0]
                    if "unique" in str(email_error).lower():
                        error_message = "This email address is already registered"
                    else:
                        error_message = str(email_error)
                elif "password" in errors:
                    error_message = str(errors["password"][0])

                return self.error_res(
                    code="VALIDATION_ERROR",
                    error=error_message,
                    message="Failed to register user. Please try again.",
                    status_code=400,
                )

        except Exception as e:
            return self.error_res(
                code="TRY_AGAIN",
                error=str(e),
                message="Failed to register user. Please try again.",
                status_code=500,
            )


class Login(APIView, BaseController):
    permission_classes = (AllowAny,)

    def post(self, request):
        try:
            serialized_data = LoginSerializer(data=request.data)
            serialized_data.is_valid()

            user = User.objects.get(
                email=serialized_data.validated_data["email"])

            # ✅ Check if the user is verified before allowing login
            if not user.is_verified:
                return self.error_res(
                    code="EMAIL_NOT_VERIFIED",
                    error="Email Not Verified",
                    message="Your email is not verified. Please verify your email before logging in.",
                    status_code=403,
                )

            if user.check_password(serialized_data.validated_data["password"]):
                encode_data = {"id": user.id, "email": user.email}
                access_token = create_access_token(encode_data)
                user_data = UserSerializer(user).data
                subscriptions = Subscriptions.objects.select_related("sub_plan").get(
                    user=user
                )
                sub_plan = subscriptions.sub_plan
                if sub_plan.plan == "FREE":
                    current_time = timezone.now()
                    if current_time > subscriptions.subcription_end_at:
                        urls = Urls.objects.filter(user_id=user)
                        urls.update(is_active=False)
                        return super().success_res(
                            code="SUBSCRIPTION_ENDED",
                            data={
                                "user_data": user_data,
                                "message": "Your subscription has ended",
                                "is_subcription_ended": True,
                                "access_token": access_token,
                                "token_type": "Bearer",
                                "url_limit": settings.FREE_PLAN_URL_LIMIT,
                                "duration_days": settings.FREE_PLAN_DURATION_DAYS,
                                "subscription_start_date": subscriptions.subcription_start_at.isoformat(),
                            },
                        )
                # Check subscription plan and return appropriate message
                if sub_plan.plan == "PREMIUM":
                    return super().success_res(
                        code="PREMIUM_SUBSCRIPTION",
                        status_code=200,
                        data={
                            "user_data": user_data,
                            "message": "You are in premium subscription",
                            "is_subcription_ended": False,
                            "access_token": access_token,
                            "token_type": "Bearer",
                            "subscription_plan": sub_plan.plan,
                            "url_limit": -1 if settings.PREMIUM_PLAN_UNLIMITED else settings.PAID_PLAN_URL_LIMIT,
                            "duration_days": settings.PAID_PLAN_DURATION_DAYS,
                            "subscription_start_date": subscriptions.subcription_start_at.isoformat(),
                        },
                    )
                else:
                    return super().success_res(
                        code="FREE_SUBSCRIPTION",
                        status_code=200,
                        data={
                            "user_data": user_data,
                            "message": "Your Are In Free Subscription",
                            "is_subcription_ended": False,
                            "access_token": access_token,
                            "token_type": "Bearer",
                            "subscription_plan": sub_plan.plan,
                            "url_limit": settings.FREE_PLAN_URL_LIMIT,
                            "duration_days": settings.FREE_PLAN_DURATION_DAYS,
                            "subscription_start_date": subscriptions.subcription_start_at.isoformat(),
                        },
                    )
            else:
                return super().error_res(
                    code="WRONG_PASSWORD",
                    error="Password is wrong",
                    message="Password is wrong",
                    status_code=404,
                )
        except User.DoesNotExist:
            return super().error_res(
                code="USER_NOT_FOUND",
                error="User does not exist",
                message="User does not exist",
                status_code=404,
            )
        except Exception as e:
            print(e)
            return super().error_res(
                code="TRY_AGAIN",
                error=f"An unexpected error occurred {str(e)}",
                message="Try Again Later",
                status_code=500,
            )


class ChangePassword(APIView, BaseController):
    permission_classes = (AllowAny,)

    def post(self, request):
        try:
            serialized_data = ChangePasswordSerializer(data=request.data)
            serialized_data.is_valid(raise_exception=True)
            auth_header = request.headers.get("Authorization")
            if not auth_header or "Bearer " not in auth_header:
                return super().error_res(
                    code="HEADER_MISSING_OR_MALFORMED",
                    status_code=401,
                    error="Authorization header missing or malformed",
                    message="Authorization token is required",
                )
            token = auth_header.split("Bearer ")[1]
            user_info = decode_token(token)
            if user_info is False:
                return super().error_res(
                    code="TOKEN_EXPIRED",
                    status_code=401,
                    error="Token Expired",
                    message="Session Expired Login Again",
                )

            user = User.objects.get(email=user_info["email"])
            print(f"Retrieved user: {user}")  # Debug statement

            if user.check_password(serialized_data.validated_data["old_password"]):
                user.set_password(
                    serialized_data.validated_data["new_password"])
                user.save()
                print("Password updated successfully")  # Debug statement
                return super().success_res(
                    code="UPDATED",
                    status_code=200, data={"message": "Password Updated"}
                )
            else:
                return super().error_res(
                    code="NOT_MATCH",
                    error="Old Password Does Not Match",
                    message="Old Password Does Not Match",
                    status_code=401,
                )
        except Exception as e:
            print(f"Exception occurred: {e}")  # Debug statement
            return super().error_res(
                code="TRY_AGAIN",
                error=f"An unexpected error occurred {str(e)}",
                message="Try Again Later",
                status_code=500,
            )


class ForgetPassword(APIView, BaseController):
    permission_classes = (AllowAny,)

    def post(self, request):
        serialize_email = ForgetPassWordSerializer(data=request.data)
        serialize_email.is_valid(raise_exception=True)
        host_url = request.get_host()
        try:
            user = User.objects.get(
                email=serialize_email.validated_data["email"])
            token = create_access_token(data={"email": user.email})
            url = (
                f"http://{host_url}/user/reset_password/?token={token}"
            )

            message = render_to_string(
                "password_reset_email.html",
                {
                    "user": user,
                    "link": url,
                },
            )
            mail.send(
                recipients=user.email,
                sender=DEFAULT_FROM_EMAIL,
                subject="Password Reset Form",
                message="",
                html_message=message,
            )

            user.passowrd_request_valid = True
            user.save()
            return super().success_res(
                code="SUCCESS",
                message="Password reset link sent successfully", status_code=200
            )
        except User.DoesNotExist:
            return super().error_res(
                code="NOT_EXISTS",
                error="User Not Exists",
                message=f"The email {serialize_email.validated_data['email']} is not registered",
                status_code=404,
            )
        except Exception as e:
            return super().error_res(
                code="TRY_AGAIN",
                error=f"An unexpected error occured as {e}",
                message="Try Again Later",
                status_code=500,
            )


def render_template(request):
    return render(request=request, template_name="reset_password.html")


def confirm_reset_password(request):
    if request.method == "POST":
        token = request.POST.get("token")
        res = {"message": "", "success": False}

        # Decode the token and check for validity
        user_info = decode_token(token)
        if user_info is False:
            res["message"] = "Token Expired"
            return JsonResponse(res, status=200)

        password1 = request.POST.get("password1")
        password2 = request.POST.get("password2")

        # Check if passwords match
        if password1 != password2:
            res["message"] = "Passwords do not Match"
            return JsonResponse(res, status=200)

        try:
            # Retrieve user and update password
            user = User.objects.get(email=user_info["email"])

            if user.passowrd_request_valid == False:
                res["message"] = "Password reset link expired"
                return JsonResponse(res, status=200)

            user.set_password(password1)
            user.passowrd_request_valid = False
            user.save()

            res["message"] = "Password reset successfully. Login from the extension now"
            res["success"] = True
            return JsonResponse(res, status=200)

        except ValidationError as e:
            res["message"] = "Choose A Strong Password"
            return JsonResponse(res, status=200)

        except User.DoesNotExist:
            res["message"] = "User Not Found"
            return JsonResponse(res, status=200)

        except Exception as e:
            res["message"] = "An unexpected error occurred. Try Again Later"
            return JsonResponse(res, status=200)

    else:
        raise Http404


class VerifyEmail(APIView, BaseController):
    permission_classes = (AllowAny,)

    def post(self, request):
        try:
            # Validate request data
            serializer = VerifyEmailSerializer(data=request.data)
            serializer.is_valid(raise_exception=True)

            email = serializer.validated_data["email"]
            otp_code = serializer.validated_data["code"]

            # Check if OTP exists
            try:
                verification_code = VerificationCode.objects.get(
                    user__email=email, code=otp_code)
            except VerificationCode.DoesNotExist:
                return self.error_res(
                    code="INVALID_OTP",
                    status_code=400,
                    error="Invalid OTP",
                    message="The OTP you entered is incorrect.",
                )

            # Check if OTP has expired
            if verification_code.is_expired():
                return self.error_res(
                    code="OTP_EXPIRED",
                    status_code=400,
                    error="OTP Expired",
                    message="The OTP has expired. Please request a new one.",
                )

            # Mark user as verified
            user = verification_code.user
            user.is_verified = True
            user.is_active = True
            user.save()

            # Delete OTP record after successful verification
            verification_code.delete()

            return self.success_res(
                code="VERIFIED",
                status_code=200,
                message="Your email has been successfully verified. You can now log in.",
            )

        except Exception as e:
            return self.error_res(
                code="TRY_AGAIN",
                status_code=400,
                error=f"Unexpected Error: {e}",
                message="An unexpected error occurred. Please try again.",
            )


class ResendOTP(APIView, BaseController):
    permission_classes = (AllowAny,)

    def post(self, request):
        try:
            # Validate email from request
            email = request.data.get("email")
            if not email:
                return self.error_res(
                    code="EMAIL_REQUIRED",
                    status_code=400,
                    error="Email Required",
                    message="Please provide an email to resend OTP.",
                )

            # Fetch user
            try:
                user = User.objects.get(email=email)
            except User.DoesNotExist:
                return self.error_res(
                    code="USER_NOT_FOUND",
                    status_code=404,
                    error="User Not Found",
                    message="No account found with this email.",
                )

            # Check if user is already verified
            if user.is_verified:
                return self.error_res(
                    code="ALREADY_VERIFIED",
                    status_code=400,
                    error="User Already Verified",
                    message="Your account is already verified.",
                )

            # Resend OTP via email
            send_verification_email(user)

            return self.success_res(
                code="OTP_RESENT",
                status_code=200,
                message="A new verification code has been sent to your email.",
            )

        except Exception as e:
            return self.error_res(
                code="TRY_AGAIN",
                status_code=400,
                error=f"Unexpected Error: {e}",
                message="An unexpected error occurred. Please try again.",
            )



class GetPlanConfig(APIView, BaseController):
    permission_classes = (AllowAny,)

    def get(self, request):
        try:
            auth_header = request.headers.get("Authorization")
            if not auth_header or "Bearer " not in auth_header:
                return super().error_res(
                    code="HEADER_MISSING_OR_MALFORMED",
                    status_code=401,
                    error="Authorization header missing or malformed",
                    message="Authorization token is required",
                )
            token = auth_header.split("Bearer ")[1]
            user_info = decode_token(token)
            if user_info is False:
                return super().error_res(
                    code="TOKEN_EXPIRED",
                    status_code=401,
                    error="Token Expired",
                    message="Session Expired Login Again",
                )

            user = User.objects.get(id=user_info["id"])
            user_data = UserSerializer(user).data
            subscriptions = Subscriptions.objects.select_related("sub_plan").get(user=user)
            sub_plan = subscriptions.sub_plan
            
            if sub_plan.plan == "FREE":
                current_time = timezone.now()
                if current_time > subscriptions.subcription_end_at:
                    return super().success_res(
                        code="SUBSCRIPTION_ENDED",
                        data={
                            "user_data": user_data,
                            "message": "Your Subscription Has Ended",
                            "is_subcription_ended": True,
                            "subscription_plan": sub_plan.plan,
                            "url_limit": settings.FREE_PLAN_URL_LIMIT,
                            "duration_days": settings.FREE_PLAN_DURATION_DAYS,
                        },
                    )
            
            if sub_plan.plan == "PREMIUM":
                return super().success_res(
                    code="PREMIUM_SUBSCRIPTION",
                    status_code=200,
                    data={
                        "user_data": user_data,
                        "message": "You Are In Premium Subscription",
                        "is_subcription_ended": False,
                        "subscription_plan": sub_plan.plan,
                        "url_limit": settings.PAID_PLAN_URL_LIMIT,
                        "duration_days": settings.PAID_PLAN_DURATION_DAYS,
                    },
                )
            else:
                return super().success_res(
                    code="FREE_SUBSCRIPTION",
                    status_code=200,
                    data={
                        "user_data": user_data,
                        "message": "Your Are In Free Subscription",
                        "is_subcription_ended": False,
                        "subscription_plan": sub_plan.plan,
                        "url_limit": settings.FREE_PLAN_URL_LIMIT,
                        "duration_days": settings.FREE_PLAN_DURATION_DAYS,
                    },
                )

        except User.DoesNotExist:
            return super().error_res(
                code="USER_NOT_FOUND",
                error="User does not exist",
                message="User does not exist",
                status_code=404,
            )
        except Exception as e:
            return super().error_res(
                code="TRY_AGAIN",
                error=f"An unexpected error occurred {str(e)}",
                message="Try Again Later",
                status_code=500,
            )