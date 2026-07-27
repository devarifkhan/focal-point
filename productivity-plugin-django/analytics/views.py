from rest_framework.views import APIView
from rest_framework.permissions import AllowAny
from rest_framework import status
from classes.base_controler import BaseController
from users.utils import decode_token
from users.models import User
from urlshandler.models import Urls
from subscriptions.models import Subscriptions, Payment
from analytics.models import UserActivity
from django.db.models import Sum, Count, Avg
from django.utils import timezone
from datetime import timedelta, datetime


class DashboardAPI(APIView, BaseController):
    permission_classes = (AllowAny,)

    def get(self, request):
        try:
            auth_header = request.headers.get("Authorization")
            if not auth_header or "Bearer " not in auth_header:
                return super().error_res(
                    code="HEADER_MISSING_OR_MALFORMED",
                    status_code=status.HTTP_400_BAD_REQUEST,
                    error="Authorization Header Missing",
                    message="Authorization Header Missing or Malformed",
                )
            token = auth_header.split("Bearer ")[1]
            user_info = decode_token(token)
            if user_info is False:
                return super().error_res(
                    code="TOKEN_EXPIRED",
                    status_code=status.HTTP_400_BAD_REQUEST,
                    error="Token Expired",
                    message="Session Expired Login Again",
                )
            
            # Get date range or period parameter first
            start_date_str = request.GET.get('start_date')
            end_date_str = request.GET.get('end_date')
            period = request.GET.get('period', 7)
            
            if start_date_str or end_date_str:
                try:
                    current_date = timezone.now().date()
                    
                    if start_date_str and end_date_str:
                        start_date = datetime.strptime(start_date_str, '%Y-%m-%d').date()
                        end_date = datetime.strptime(end_date_str, '%Y-%m-%d').date()
                    elif start_date_str:
                        start_date = datetime.strptime(start_date_str, '%Y-%m-%d').date()
                        end_date = current_date
                    elif end_date_str:
                        end_date = datetime.strptime(end_date_str, '%Y-%m-%d').date()
                        start_date = None  # Show all data up to end_date
                    
                    period_label = f"{start_date} to {end_date}"
                except ValueError:
                    return super().error_res(
                        code="INVALID_DATE_FORMAT",
                        error="Invalid date format. Use YYYY-MM-DD",
                        status_code=status.HTTP_400_BAD_REQUEST,
                        message="Date format should be YYYY-MM-DD",
                    )
            else:
                period = int(period) if str(period).isdigit() else 7
                if period not in [7, 30]:
                    period = 7
                end_date = timezone.now().date()
                start_date = end_date - timedelta(days=period)
                period_label = f"{period} days"

            user = User.objects.get(id=user_info["id"])
            urls = Urls.objects.filter(user_id=user.id)
            subscription = Subscriptions.objects.select_related('sub_plan').get(user=user)
            
            # Get activity data for the date range
            if start_date:
                activity_data = UserActivity.objects.filter(
                    user=user,
                    date__gte=start_date,
                    date__lte=end_date
                ).aggregate(
                    total_time=Sum('time_saved_minutes'),
                    total_blocked=Sum('urls_blocked'),
                    total_visits=Sum('sites_visited')
                )
                # Check if there's any activity data for this date range
                has_activity = UserActivity.objects.filter(
                    user=user,
                    date__gte=start_date,
                    date__lte=end_date
                ).exists()
            else:
                activity_data = UserActivity.objects.filter(
                    user=user,
                    date__lte=end_date
                ).aggregate(
                    total_time=Sum('time_saved_minutes'),
                    total_blocked=Sum('urls_blocked'),
                    total_visits=Sum('sites_visited')
                )
                has_activity = UserActivity.objects.filter(
                    user=user,
                    date__lte=end_date
                ).exists()
            
            # If no activity data exists for the date range, show 0 for URL stats
            if has_activity:
                total_urls = urls.count()
                active_urls = urls.filter(is_active=True, visited=False).count()
                inactive_urls = urls.filter(is_active=False).count()
                visited_urls = urls.filter(visited=True).count()
            else:
                total_urls = 0
                active_urls = 0
                inactive_urls = 0
                visited_urls = 0
            
            # Calculate average time per URL based on activity data
            total_time = activity_data['total_time'] or 0
            avg_time_per_url = (total_time / total_urls) if total_urls > 0 else 0
            
            # Plan usage with proper unlimited handling (use actual user URLs, not activity-filtered)
            from django.conf import settings
            actual_total_urls = urls.count()  # Always show actual URL count for plan usage
            
            if subscription.sub_plan.plan == 'FREE':
                urls_limit = settings.FREE_PLAN_URL_LIMIT
                usage_percentage = round((actual_total_urls / urls_limit) * 100, 1) if urls_limit > 0 else 0
            elif subscription.sub_plan.plan == 'PREMIUM' and getattr(settings, 'PREMIUM_PLAN_UNLIMITED', True):
                urls_limit = -1  # Unlimited
                usage_percentage = 0
            else:
                urls_limit = settings.PAID_PLAN_URL_LIMIT
                usage_percentage = round((actual_total_urls / urls_limit) * 100, 1) if urls_limit > 0 else 0
            
            plan_usage = {
                'current_plan': subscription.sub_plan.plan,
                'urls_used': actual_total_urls,
                'urls_limit': urls_limit,
                'usage_percentage': usage_percentage
            }
            
            return super().success_res(
                code="SUCCESS",
                message=f"Dashboard data retrieved successfully ({period_label})",
                status_code=status.HTTP_200_OK,
                data={
                    'period': period_label,
                    'date_range': {
                        'start_date': str(start_date),
                        'end_date': str(end_date)
                    },
                    'quick_stats': {
                        'total_urls': total_urls,
                        'active_urls': active_urls,
                        'inactive_urls': inactive_urls,
                        'visited_urls': visited_urls,
                        'total_time_minutes': round(total_time, 2),
                        'avg_time_per_url': round(avg_time_per_url, 2),
                        'total_blocked_attempts': activity_data['total_blocked'] or 0,
                        'total_sites_visited': activity_data['total_visits'] or 0,
                    },
                    'range_stats': {
                        'total_urls': total_urls,
                        'active_urls': active_urls,
                        'visited_urls': visited_urls,
                        'total_time_minutes': round(total_time, 2),
                        'avg_time_per_url': round(avg_time_per_url, 2),
                        'total_blocked_attempts': activity_data['total_blocked'] or 0,
                        'total_sites_visited': activity_data['total_visits'] or 0,
                    },
                    'plan_usage': plan_usage,
                }
            )
            
        except Exception as e:
            return super().error_res(
                code="DASHBOARD_ERROR",
                error=f"Dashboard Error: {e}",
                status_code=status.HTTP_400_BAD_REQUEST,
                message="Failed to retrieve dashboard data",
            )


class AdminAnalyticsAPI(APIView, BaseController):
    permission_classes = (AllowAny,)

    def get(self, request):
        try:
            auth_header = request.headers.get("Authorization")
            if not auth_header or "Bearer " not in auth_header:
                return super().error_res(
                    code="HEADER_MISSING_OR_MALFORMED",
                    status_code=status.HTTP_400_BAD_REQUEST,
                    error="Authorization Header Missing",
                    message="Authorization Header Missing or Malformed",
                )
            token = auth_header.split("Bearer ")[1]
            user_info = decode_token(token)
            if user_info is False:
                return super().error_res(
                    code="TOKEN_EXPIRED",
                    status_code=status.HTTP_400_BAD_REQUEST,
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
            
            # Total system overview
            total_users = User.objects.filter(role='USER').count()
            total_urls = Urls.objects.count()
            total_active_urls = Urls.objects.filter(is_active=True).count()
            
            # Payment overview
            total_payments = Payment.objects.count()
            successful_payments = Payment.objects.filter(status='SUCCESS').count()
            total_revenue = Payment.objects.filter(status='SUCCESS').aggregate(total=Sum('amount'))['total'] or 0
            
            # Subscription overview
            free_users = Subscriptions.objects.filter(sub_plan__plan='FREE').count()
            paid_users = Subscriptions.objects.filter(sub_plan__plan='PAID').count()
            
            # All time activity
            all_activity = UserActivity.objects.aggregate(
                total_time=Sum('time_saved_minutes'),
                total_visits=Sum('sites_visited'),
                total_blocked=Sum('urls_blocked')
            )
            
            return super().success_res(
                code="SUCCESS",
                message="Admin analytics retrieved successfully",
                status_code=status.HTTP_200_OK,
                data={
                    'system_overview': {
                        'total_users': total_users,
                        'total_urls': total_urls,
                        'active_urls': total_active_urls,
                        'inactive_urls': total_urls - total_active_urls
                    },
                    'payment_overview': {
                        'total_payments': total_payments,
                        'successful_payments': successful_payments,
                        'total_revenue': float(total_revenue),
                        'success_rate': round((successful_payments / total_payments * 100), 2) if total_payments > 0 else 0
                    },
                    'subscription_overview': {
                        'free_users': free_users,
                        'paid_users': paid_users,
                        'conversion_rate': round((paid_users / (free_users + paid_users) * 100), 2) if (free_users + paid_users) > 0 else 0
                    },
                    'activity_overview': {
                        'total_time_saved': all_activity['total_time'] or 0,
                        'total_sites_visited': all_activity['total_visits'] or 0,
                        'total_urls_blocked': all_activity['total_blocked'] or 0
                    }
                }
            )
            
        except Exception as e:
            return super().error_res(
                code="ADMIN_ANALYTICS_ERROR",
                error=f"Admin Analytics Error: {e}",
                status_code=status.HTTP_400_BAD_REQUEST,
                message="Failed to retrieve admin analytics",
            )