from django.shortcuts import render, redirect
from django.http import HttpResponse
from rest_framework.permissions import AllowAny
from rest_framework.views import APIView
from classes.base_controler import BaseController
from users.models import User
from urlshandler.models import Urls
from subscriptions.models import SubscriptionPlan, Subscriptions, Payment
from subscriptions.serializers import (
    UserSubscriptionSerializer,
    UserSubcriptionsUpdateSerializer,
)
from users.utils import decode_token
from django.conf import settings
from subscriptions.sslcommerz import SSLCommerzPayment
from django.utils import timezone
from datetime import timedelta
from django.db.models import Sum, Count
import uuid


class RetrieveUserSubscriptionsAPI(APIView, BaseController):
    permission_classes = (AllowAny,)

    def get(self, request):
        try:
            auth_header = request.headers.get("Authorization")
            if not auth_header:
                return super().error_res(
                    code="TOKEN_MISSING",
                    error="No Token Provided",
                    message="Authorization token is missing",
                    status_code=401,
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
            subscription_info = Subscriptions.objects.select_related("sub_plan").get(
                user=user
            )
            subscription_plan = subscription_info.sub_plan
            response_data = UserSubscriptionSerializer(
                data={
                    "subcription_id": subscription_info.id,
                    "subscription_start_at": subscription_info.subcription_start_at,
                    "plan": subscription_plan.plan,
                    "plan_duartion": subscription_plan.plan_duartion,
                    "max_url_storage": settings.FREE_PLAN_URL_LIMIT if subscription_plan.plan == 'FREE' else (-1 if settings.PREMIUM_PLAN_UNLIMITED else settings.PAID_PLAN_URL_LIMIT),
                    "price": subscription_plan.price,
                }
            )
            response_data.is_valid(raise_exception=True)
            return super().success_res(
                data=response_data.data,
                status_code=200,
                code="Subscription Retrieved Successfully",
            )
        except User.DoesNotExist:
            return super().error_res(
                code="NOT_FOUND",
                error="User Does Not Exist",
                message="Invalid Credential",
                status_code=401,
            )
        except Subscriptions.DoesNotExist:
            return super().error_res(
                code="SUBSCRIPTION_NOT_FOUND",
                error="Subscription Does Not Exist",
                message="Invalid Subscription",
                status_code=401,
            )
        except Exception as e:
            print(e)
            return super().error_res(
                code="Unexpected Error Occurred",
                error="Unexpected Error Occurred",
                message=str(e),
                status_code=500,
            )


class UpgradeSubscriptionsPlanApi(APIView, BaseController):

    permission_classes = (AllowAny,)

    def put(self, request):
        try:
            auth_header = request.headers.get("Authorization")
            if not auth_header:
                return super().error_res(
                    code="TOKEN_MISSING",
                    error="No Token Provided",
                    message="Authorization token is missing",
                    status_code=401,
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
            request.data["user_id"] = user_info["id"]
            subscription = Subscriptions.objects.get(user=user)
            serialized_data = UserSubcriptionsUpdateSerializer(
                subscription, data=request.data
            )
            serialized_data.is_valid(raise_exception=True)
            serialized_data.save()
            subscription_info = Subscriptions.objects.select_related("sub_plan").get(
                user=user
            )
            subscription_plan = subscription_info.sub_plan
            response_data = UserSubscriptionSerializer(
                data={
                    "subcription_id": subscription_info.id,
                    "subscription_start_at": subscription_info.subcription_start_at,
                    "plan": subscription_plan.plan,
                    "plan_duartion": subscription_plan.plan_duartion,
                    "max_url_storage": settings.FREE_PLAN_URL_LIMIT if subscription_plan.plan == 'FREE' else (-1 if settings.PREMIUM_PLAN_UNLIMITED else settings.PAID_PLAN_URL_LIMIT),
                    "price": subscription_plan.price,
                }
            )
            urls = Urls.objects.filter(user_id=user)
            urls.update(is_active=True)
            response_data.is_valid(raise_exception=True)
            return super().success_res(
                code="PLAN_UPGRADED",
                data={"upgraded_user_subscription": response_data.data},
                status_code=200,
                message="Subscription Plan Upgraded Successfully",
            )
        except User.DoesNotExist:
            return super().error_res(
                code="USER_NOT_EXIST",
                error="Database Error",
                message="User Does Not Exist",
                status_code=401,
            )
        except SubscriptionPlan.DoesNotExist:
            return super().error_res(
                code="PLAN_NOT_EXIST",
                error="Database Error",
                message="Subscription Plan Does Not Exist",
                status_code=401,
            )
        except Subscriptions.DoesNotExist:
            return super().error_res(
                code="SUBSCRIPTION_ERROR",
                error="Subscription Error",
                message="Plan Does Not Exist",
                status_code=401,
            )
        except Exception as e:
            return super().error_res(
                code="TRY_AGAIN",
                error="Unexpected Error",
                message=f"{e}",
                status_code=500,
            )


class ListSubscritionsPlanApi(APIView, BaseController):
    permission_classes = (AllowAny,)

    def get(self, request):
        try:
            plans = SubscriptionPlan.objects.values(
                "id", "plan", "plan_duartion", "max_url_storage", "price"
            )
            # Add environment-based config for reference
            config = {
                "free_plan_limit": settings.FREE_PLAN_URL_LIMIT,
                "paid_plan_limit": -1 if settings.PREMIUM_PLAN_UNLIMITED else settings.PAID_PLAN_URL_LIMIT,
                "paid_plan_price": settings.PAID_PLAN_PRICE,
                "premium_unlimited": settings.PREMIUM_PLAN_UNLIMITED
            }
            return super().success_res(
                data={"plans": plans, "config": config},
                status_code=200,
                code="SUCCESS",
            )
        except SubscriptionPlan.DoesNotExist:
            return super().error_res(
                error="Dtatabase Error",
                message="Plans Doesn't Exists",
                status_code=404,
                code="NOT_EXIST",
            )
        except Exception as e:
            return super().error_res(
                error="Unexpected Error Occured",
                message=f"{e}",
                status_code=500,
                code="TRY_AGAIN",
            )


class PaymentCallbackAPI(APIView, BaseController):
    permission_classes = (AllowAny,)

    def get(self, request):
        return self._handle_callback(request)
    
    def post(self, request):
        return self._handle_callback(request)
    
    def _handle_callback(self, request):
        try:
            status = request.GET.get('status', '').lower()
            
            # Get transaction data from either GET params or POST data
            if request.method == 'GET':
                transaction_id = request.GET.get('tran_id')
                amount = request.GET.get('amount')
            else:
                transaction_id = request.data.get('tran_id')
                amount = request.data.get('amount')
            
            if not transaction_id:
                return HttpResponse("Transaction ID missing", status=400)
            
            if status == 'success':
                result = self._handle_success(transaction_id, amount)
                return redirect(f"https://focusly.pro/dashboard?status=success&transaction_id={transaction_id}")
            elif status == 'failed':
                self._handle_failed(transaction_id)
                return redirect(f"https://focusly.pro/dashboard?status=failed&transaction_id={transaction_id}")
            elif status == 'cancel':
                self._handle_cancel(transaction_id)
                return redirect(f"https://focusly.pro/dashboard?status=cancel&transaction_id={transaction_id}")
            else:
                return HttpResponse("Invalid status", status=400)
                
        except Exception as e:
            return HttpResponse(f"Payment callback error: {str(e)}", status=500)
    
    def _handle_success(self, transaction_id, amount):
        try:
            payment = Payment.objects.get(transaction_id=transaction_id)
            
            # Validate payment with SSLCommerz
            sslcommerz = SSLCommerzPayment()
            is_valid = sslcommerz.validate_payment(transaction_id, amount or payment.amount)
            
            if is_valid:
                payment.status = 'SUCCESS'
                payment.save()
                
                # Upgrade user subscription
                premium_plan = SubscriptionPlan.objects.get(plan='PREMIUM')
                subscription = Subscriptions.objects.get(user=payment.user)
                subscription.sub_plan = premium_plan
                subscription.subcription_start_at = timezone.now()
                subscription.subcription_end_at = timezone.now() + timedelta(days=settings.PAID_PLAN_DURATION_DAYS)
                subscription.save()
                
                # Activate all user URLs
                Urls.objects.filter(user_id=payment.user.id).update(is_active=True)
                
                # Send success email asynchronously
                from urlshandler.tasks import send_payment_success_email
                send_payment_success_email.delay(payment.user.id, payment.id)
                
                return True
            else:
                payment.status = 'FAILED'
                payment.save()
                # Send failure email asynchronously
                from urlshandler.tasks import send_payment_failed_email
                send_payment_failed_email.delay(payment.user.id, payment.id)
                return False
        except (Payment.DoesNotExist, SubscriptionPlan.DoesNotExist, Subscriptions.DoesNotExist):
            return False
    
    def _handle_failed(self, transaction_id):
        try:
            payment = Payment.objects.get(transaction_id=transaction_id)
            payment.status = 'FAILED'
            payment.save()
            # Send failure email asynchronously
            from urlshandler.tasks import send_payment_failed_email
            send_payment_failed_email.delay(payment.user.id, payment.id)
        except Payment.DoesNotExist:
            pass
    
    def _handle_cancel(self, transaction_id):
        try:
            payment = Payment.objects.get(transaction_id=transaction_id)
            payment.status = 'CANCELLED'
            payment.save()
        except Payment.DoesNotExist:
            pass


class PlanConfigAPI(APIView, BaseController):
    permission_classes = (AllowAny,)

    def get(self, request):
        """Get current plan configuration from environment variables"""
        try:
            config = {
                "free_plan": {
                    "url_limit": settings.FREE_PLAN_URL_LIMIT,
                    "duration_days": settings.FREE_PLAN_DURATION_DAYS,
                    "price": 0
                },
                "paid_plan": {
                    "url_limit": -1 if settings.PREMIUM_PLAN_UNLIMITED else settings.PAID_PLAN_URL_LIMIT,
                    "duration_days": settings.PAID_PLAN_DURATION_DAYS,
                    "price": settings.PAID_PLAN_PRICE,
                    "unlimited": settings.PREMIUM_PLAN_UNLIMITED
                }
            }
            return super().success_res(
                data=config,
                status_code=200,
                code="SUCCESS"
            )
        except Exception as e:
            return super().error_res(
                error="Configuration Error",
                message=str(e),
                status_code=500,
                code="CONFIG_ERROR"
            )


class AdminPaymentAnalyticsAPI(APIView, BaseController):
    permission_classes = (AllowAny,)

    def get(self, request):
        try:
            auth_header = request.headers.get("Authorization")
            if not auth_header:
                return super().error_res(
                    code="TOKEN_MISSING",
                    error="No Token Provided",
                    message="Authorization token is missing",
                    status_code=401,
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
            if not user.is_admin():
                return super().error_res(
                    code="ACCESS_DENIED",
                    error="Access Denied",
                    message="Admin access required",
                    status_code=403,
                )
            
            # All payments overview
            payments = Payment.objects.all()
            total_payments = payments.count()
            successful_payments = payments.filter(status='SUCCESS').count()
            total_revenue = payments.filter(status='SUCCESS').aggregate(total=Sum('amount'))['total'] or 0
            
            # User payments details
            user_payments = Payment.objects.select_related('user').values(
                'user__email', 'user__first_name', 'user__last_name',
                'transaction_id', 'amount', 'status', 'created_at'
            ).order_by('-created_at')
            
            return super().success_res(
                data={
                    'payment_summary': {
                        'total_payments': total_payments,
                        'successful_payments': successful_payments,
                        'failed_payments': total_payments - successful_payments,
                        'total_revenue': float(total_revenue),
                        'success_rate': round((successful_payments / total_payments * 100), 2) if total_payments > 0 else 0
                    },
                    'user_payments': list(user_payments)
                },
                status_code=200,
                code="SUCCESS"
            )
            
        except Exception as e:
            return super().error_res(
                code="ADMIN_ERROR",
                error="Admin Error",
                message=str(e),
                status_code=500
            )


class UserPaymentHistoryAPI(APIView, BaseController):
    permission_classes = (AllowAny,)

    def get(self, request):
        try:
            auth_header = request.headers.get("Authorization")
            if not auth_header:
                return super().error_res(
                    code="TOKEN_MISSING",
                    error="No Token Provided",
                    message="Authorization token is missing",
                    status_code=401,
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
            
            # User can only see their own payments
            user_payments = Payment.objects.filter(user_id=user_info["id"]).values(
                'transaction_id', 'amount', 'status', 'created_at'
            ).order_by('-created_at')
            
            return super().success_res(
                data={'payments': list(user_payments)},
                status_code=200,
                code="SUCCESS"
            )
            
        except Exception as e:
            return super().error_res(
                code="PAYMENT_ERROR",
                error="Payment Error",
                message=str(e),
                status_code=500
            )


class InitiatePaymentAPI(APIView, BaseController):
    permission_classes = (AllowAny,)

    def post(self, request):
        try:
            auth_header = request.headers.get("Authorization")
            if not auth_header:
                return super().error_res(
                    code="TOKEN_MISSING",
                    error="No Token Provided",
                    message="Authorization token is missing",
                    status_code=401,
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
            
            # Get phone number from request body and save to user
            phone_number = request.data.get('phone_number', '')
            if phone_number:
                user.phone_number = phone_number
                user.save()
            
            # Check if user is already on paid plan
            subscription = Subscriptions.objects.get(user=user)
            if subscription.sub_plan.plan == "PREMIUM":
                return super().error_res(
                    code="ALREADY_PAID",
                    error="Already on paid plan",
                    message="You are already on a paid plan",
                    status_code=400,
                )
            
            # Generate unique transaction ID
            transaction_id = f"TXN_{user.id}_{uuid.uuid4().hex[:8]}"
            
            # Debug: Print the price being used
            print(f"DEBUG: PAID_PLAN_PRICE from settings: {settings.PAID_PLAN_PRICE}")
            print(f"DEBUG: Type of PAID_PLAN_PRICE: {type(settings.PAID_PLAN_PRICE)}")
            
            # Create payment record
            payment = Payment.objects.create(
                user=user,
                transaction_id=transaction_id,
                amount=settings.PAID_PLAN_PRICE,
                status='PENDING'
            )
            
            # Prepare payment data for SSLCommerz
            print(f"DEBUG: Payment data amount: {settings.PAID_PLAN_PRICE}")
            payment_data = {
                'amount': settings.PAID_PLAN_PRICE,
                'transaction_id': transaction_id,
                'success_url': 'https://focusly-api.shadhin.ai/subscriptions/payment/?status=success',
                'fail_url': 'https://focusly-api.shadhin.ai/subscriptions/payment/?status=failed',
                'cancel_url': 'https://focusly-api.shadhin.ai/subscriptions/payment/?status=cancel',
                'customer_name': f"{user.first_name} {user.last_name}",
                'customer_email': user.email,
                'customer_phone': phone_number,
                'product_name': 'Premium Subscription Plan'
            }
            
            # Initialize SSLCommerz payment
            sslcommerz = SSLCommerzPayment()
            response = sslcommerz.create_session(payment_data)
            
            if response.get('status') == 'SUCCESS':
                payment.sslcommerz_session_id = response.get('sessionkey')
                payment.save()
                
                return super().success_res(
                    data={
                        'payment_url': response.get('GatewayPageURL'),
                        'transaction_id': transaction_id,
                        'amount': settings.PAID_PLAN_PRICE
                    },
                    status_code=200,
                    code="PAYMENT_INITIATED"
                )
            else:
                payment.status = 'FAILED'
                payment.save()
                return super().error_res(
                    code="PAYMENT_FAILED",
                    error="Payment initiation failed",
                    message=response.get('failedreason', 'Unknown error'),
                    status_code=400
                )
                
        except Exception as e:
            return super().error_res(
                code="PAYMENT_ERROR",
                error="Payment Error",
                message=str(e),
                status_code=500
            )



