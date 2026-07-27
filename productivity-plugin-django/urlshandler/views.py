from rest_framework import status
from rest_framework.views import APIView
from rest_framework.permissions import AllowAny
from django.utils import timezone
from urlshandler.models import Urls
from users.models import User
from subscriptions.models import Subscriptions
from urlshandler.serializer import UrlSerializer, UpdateUrlsSerializer
from classes.base_controler import BaseController
from users.utils import decode_token, get_timezone_from_ip, get_client_ip
from django.core.files.uploadedfile import InMemoryUploadedFile
from rest_framework.parsers import MultiPartParser, FormParser
from django.conf import settings
from django.db.models import Count, Sum, Avg, Q
import logging
from django.db.models import Sum
from analytics.models import UserActivity
from datetime import datetime

class TrackBlockedAttemptAPI(APIView, BaseController):
    permission_classes = (AllowAny,)

    def post(self, request):
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
            blocked_url = request.data.get("blocked_url")
            estimated_time = float(request.data.get("estimated_time", 5))  # Default 5 minutes
            
            from analytics.utils import track_blocked_attempt
            activity = track_blocked_attempt(user, blocked_url, estimated_time)
            
            return super().success_res(
                code="SUCCESS",
                message="Blocked attempt tracked successfully",
                status_code=status.HTTP_200_OK,
                data={
                    "blocked_url": blocked_url,
                    "time_saved": estimated_time,
                    "date": timezone.now().date().isoformat()
                }
            )
            
        except Exception as e:
            return super().error_res(
                code="TRACKING_ERROR",
                error=f"Tracking Error: {e}",
                status_code=status.HTTP_400_BAD_REQUEST,
                message="Failed to track blocked attempt",
            )


class UrlStore(APIView, BaseController):
    permission_classes = (AllowAny,)

    def post(self, request):
        try:
            auth_header = request.headers.get("Authorization")
            if not auth_header or "Bearer " not in auth_header:
                return super().error_res(
                    code="HEADER_MISSING_OR_MALFORMED",
                    status_code=status.HTTP_400_BAD_REQUEST,
                    error="Authorization Header Missing",
                    message="Authorization Header Missing or Malformed",
                )
            print("payload",request.data)
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
            subscriptions = Subscriptions.objects.select_related("sub_plan").get(
                user=user
            )
            subscription_plan = subscriptions.sub_plan
            if subscription_plan.plan == "FREE":
                current_time = timezone.now()
                if current_time > subscriptions.subcription_end_at:
                    return super().success_res(
                        code="Subscriptions_Expired",
                        data={"is_subcription_ended": True},
                        message="Subscriptions expired try premium version",
                        status_code=status.HTTP_400_BAD_REQUEST,
                    )
                # Use environment variable for free plan limit
                if user.total_url_stored >= settings.FREE_PLAN_URL_LIMIT:
                    return super().success_res(
                        data={"is_subcription_ended": True},
                        message=f"You can only block {settings.FREE_PLAN_URL_LIMIT} sites for free subscriptions",
                        status_code=status.HTTP_400_BAD_REQUEST,
                    )
            elif subscription_plan.plan == "PREMIUM":
                # Check if PREMIUM plan has unlimited URLs or a specific limit
                if not settings.PREMIUM_PLAN_UNLIMITED and user.total_url_stored >= settings.PAID_PLAN_URL_LIMIT:
                    return super().success_res(
                        data={"is_subcription_ended": True},
                        message=f"You have reached the maximum limit of {settings.PAID_PLAN_URL_LIMIT} sites for your plan",
                        status_code=status.HTTP_400_BAD_REQUEST,
                    )

            block_urls = request.data.get("block_urls")
            if Urls.objects.filter(
                user_id=user_info["id"], block_urls=block_urls
            ).exists():
                return super().error_res(
                    code="URL_EXISTS",
                    error="URL Already Exists",
                    message="The site is already blocked.",
                    status_code=status.HTTP_400_BAD_REQUEST,
                )

            request.data["user_id"] = user_info["id"]
            serialized_data = UrlSerializer(data=request.data)
            print("Serialized Data", serialized_data)
            
            serialized_data.is_valid(raise_exception=True)
            url = serialized_data.save()
            
            # Get user timezone from IP if not provided
            user_timezone = request.data.get("timezone")
            
            if not user_timezone:
                client_ip = get_client_ip(request)
                user_timezone = get_timezone_from_ip(client_ip)
                
            # Update user's timezone
            if user_timezone:
                user.timezone = user_timezone
                
            user.total_url_stored = user.total_url_stored + 1
            
            user.save()
            
            # Schedule URL reset for user with timezone
            # We've just added a URL, so there's at least one URL
            # from urlshandler.tasks import schedule_reset_for_user
            # print(f"Creating task for user {user.id} who now has {user.total_url_stored} URLs")
            # # Call directly for immediate execution
            # result = schedule_reset_for_user(user.id, user.timezone if user.timezone else 'Asia/Dhaka')
            # print(f"Task result: {result}")
            
            # task_scheduled = result.get('task_id') is not None
            # task_id = result.get('task_id')
            
            # # Add more detailed logging about task scheduling result
            # print(f"Task scheduling initiated with async ID: {task_id}")
            
            return super().success_res(
                code="SUCCESS",
                status_code=status.HTTP_201_CREATED,
                message="Url Blocked Successfully",
                data={
                    "is_subcription_ended": False,
                    "url_blocked": url.block_urls,
                    "redirect_url": url.redirect_urls,
                    "timezone": user_timezone,
                    # "task_scheduled": task_scheduled,
                    # "task_id": task_id,
                    "temporary_time": url.temporary_time
                },
            )
        except Exception as e:
            return super().error_res(
                code="TRY_AGAIN",
                error=f"Unexpected Error Occured as {e}",
                status_code=status.HTTP_400_BAD_REQUEST,
            )


class RetriveUrlsList(APIView, BaseController):
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
            list_of_urls = Urls.objects.filter(user_id=user_info["id"]).values(
                "id",
                "block_urls",
                "redirect_urls",

                "visited",
                "used_time",
                "half_time_notified",
                "one_quarter_notified",
                "three_quarter_notified",
                "default_time",
                "is_active",
                "calender_url",
                "message",
                "edit",
                "is_temporary",
                "image",
                "temporary_time",
                "today_limit"
            )
            return super().success_res(
                code="SUCCESS",
                message="Urls Retrieved Successfully",
                status_code=status.HTTP_200_OK,
                data={"urls": list_of_urls},
            )
        except Urls.DoesNotExist:
            return super().error_res(
                code="NO_URLS_FOUND",
                error="User Has Not Added Any Urls Yet",
                message="User Has Not Added Any Urls Yet",
                status_code=status.HTTP_400_BAD_REQUEST,
            )
        except Exception as e:
            return super().error_res(
                code="TRY_AGAIN",
                error=f"Unexpected Error Occured as {e}",
                status_code=status.HTTP_400_BAD_REQUEST,
                message="Unexpected Error Occured",
            )


class DeleteUrl(APIView, BaseController):
    permission_classes = (AllowAny,)

    def delete(self, request, id):
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
            url = Urls.objects.filter(user_id=user_info["id"]).get(id=id)
            user = User.objects.get(id=user_info["id"])
            
            # Get the URL details before deletion
            url_details = {
                'id': url.id,
                'block_urls': url.block_urls
            }
            
            # Delete associated analytics data
            from analytics.models import UserActivity
            UserActivity.objects.filter(user=user).delete()
            
            # Delete the URL
            url.delete()
            
            # Update user's URL count
            user.total_url_stored = user.total_url_stored - 1
            user.save()
            
            # Check if user has any URLs left
            remaining_urls = Urls.objects.filter(user_id=user_info["id"]).count()
            
            # If user still has URLs, update their scheduled tasks
            # Otherwise, delete the scheduled task since there are no URLs to reset
            # if remaining_urls > 0:
            #     # Import here to avoid circular imports
            #     from urlshandler.tasks import schedule_reset_for_user
            #     task = schedule_reset_for_user.delay(user.id, user.timezone if user.timezone else 'Asia/Dhaka')
            #     task_updated = True
            #     task_id = task.id
            #     print(f"Task scheduled with ID: {task.id} after URL deletion - Will be executed asynchronously")
            # else:
            #     # Delete any existing tasks for this user since they have no URLs left
            #     from django_celery_beat.models import PeriodicTask
            #     deleted_tasks = PeriodicTask.objects.filter(
            #         name__contains=f"Reset URLs for user {user_info['id']}"
            #     ).delete()
            #     print(f"Deleted scheduled tasks as user has no URLs left: {deleted_tasks}")
            #     task_updated = False
            #     task_id = None
            
            return super().success_res(
                code="SUCCESS",
                data={
                    "response": "Url Deleted Successfully",
                    "deleted_url": url_details['block_urls'],
                    "remaining_urls": remaining_urls,
                    # "task_updated": task_updated,
                    # "task_id": task_id
                },
                status_code=status.HTTP_200_OK,
            )
        except Urls.DoesNotExist:
            return super().error_res(
                code="NOT_FOUND",
                error=f"Urls Not Found",
                message="Urls Not Found",
                status_code=status.HTTP_400_BAD_REQUEST,
            )
        except Exception as e:
            return super().error_res(
                code="TRY_AGAIN",
                error=f"Unexpected Error Occured as {e}",
                status_code=status.HTTP_400_BAD_REQUEST,
                message="Unexpected Error Occured",
            )


class UpdateUrlsView(APIView, BaseController):
    permission_classes = (AllowAny,)
    parser_classes = (MultiPartParser, FormParser)

    def put(self, request, id):
        try:
            logger = logging.getLogger(__name__)
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
            logger.debug("Incoming request data: %s", request.data)
            logger.debug("Incoming files: %s", request.FILES)
            # :hammer_and_wrench: Make a mutable copy of request.data
            data = request.data.copy()
            print(data)
            # Fetch the URL object
            url = Urls.objects.filter(user_id=user_info["id"]).get(id=id)
            # :white_check_mark: Now, you can modify `data`
            data["user_id"] = user_info["id"]
            # Handle boolean values from FormData
            is_temporary = data.get("is_temporary", "").lower() == "true"
            visited = data.get("visited", "").lower() == "true"
            # half_time_notified = data.get('half_time_notified', '').lower() == 'true'
            if data.get("half_time_notified") == "false":
                half_time_notified = False
                url.half_time_notified = half_time_notified
            if data.get("half_time_notified") == "true":
                half_time_notified = True
                url.half_time_notified = half_time_notified

            # one_quarter_notified = data.get('one_quarter_notified', '').lower() == 'true'
            if data.get("one_quarter_notified") == "false":
                one_quarter_notified = False
                url.one_quarter_notified = one_quarter_notified
            if data.get("one_quarter_notified") == "true":
                one_quarter_notified = True
                url.one_quarter_notified = one_quarter_notified
            # three_quarter_notified = data.get('three_quarter_notified', '').lower() == 'true'
            if data.get("three_quarter_notified") == "false":
                three_quarter_notified = False
                url.three_quarter_notified = three_quarter_notified
            if data.get("three_quarter_notified") == "true":
                three_quarter_notified = True
                url.three_quarter_notified = three_quarter_notified

            edit = data.get("edit", "").lower() == "true"
            # Update the fields
            url.block_urls = data.get("block_urls", url.block_urls)
            url.redirect_urls = data.get("redirect_urls", url.redirect_urls)
            url.is_temporary = is_temporary

            url.visited = visited
            # url.half_time_notified = half_time_notified
            # url.one_quarter_notified = one_quarter_notified
            # url.three_quarter_notified = three_quarter_notified
            url.used_time = data.get("used_time", url.used_time)
            url.message = data.get("message", url.message)
            url.edit = edit
            url.calender_url = data.get("calender_url", url.calender_url)
            url.temporary_time = data.get("temporary_time", url.temporary_time)
            url.default_time = data.get("default_time", url.default_time)
            url.today_limit = data.get("today_limit", url.today_limit)
            # :white_check_mark: Handle file uploads correctly

            test = data.get("imageUpdate")
            print("Test", test)
            if "image" in request.FILES and test == "true":
                if url.image != None:
                    url.image.delete()
                url.image = request.FILES["image"]
            if test == "false":
                if url.image != None:
                    url.image.delete()
                url.image = None
                
            # Get user timezone from IP if not provided
            user = User.objects.get(id=user_info["id"])
            user_timezone = data.get("timezone")
            if not user_timezone:
                client_ip = get_client_ip(request)
                user_timezone = get_timezone_from_ip(client_ip)
                
            # Update user's timezone if available
            if user_timezone:
                user.timezone = user_timezone
                user.save()
                
                # Schedule URL reset for user with the new timezone
                # from urlshandler.tasks import schedule_reset_for_user
                # task = schedule_reset_for_user.delay(user.id, user.timezone)
                # task_updated = True
                # task_id = task.id
                # print(f"Task scheduled with ID: {task.id} after timezone update - Will be executed asynchronously")
            # else:
            #     task_updated = False
            #     task_id = None

            url.save()
            return super().success_res(
                code="UPDATED",
                status_code=status.HTTP_200_OK,
                message="Sites Updated Successfully",
                data={
                    "response": "Sites Updated Successfully",
                    "detected_timezone": user_timezone,
                    # "task_updated": task_updated,
                    # "task_id": task_id,
                    "url_info": {
                        "id": url.id,
                        "block_urls": url.block_urls,
                        "is_active": url.is_active
                    }
                },
            )
        except Urls.DoesNotExist:
            return super().error_res(
                code="NOT_FOUND",
                error="Urls Not Found",
                message="Urls Not Found",
                status_code=status.HTTP_400_BAD_REQUEST,
            )
        except Exception as e:
            logger.error(f"Error details: {str(e)}")
            logger.error(f"Request data: {request.data}")
            return super().error_res(
                code="TRY_AGAIN",
                error=f"An unexpected error occurred: {str(e)}",
                message="An unexpected error occurred",
                status_code=status.HTTP_400_BAD_REQUEST,
            )


class ResetTime(APIView, BaseController):
    permission_classes = (AllowAny,)

    def put(self, request, id):
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

            url = Urls.objects.filter(user_id=user_info["id"]).get(id=id)
            request.data["user_id"] = user_info["id"]
            url.block_urls = request.data.get("block_urls", url.block_urls)
            url.redirect_urls = request.data.get("redirect_urls", url.redirect_urls)

            is_temporary = request.data.get("is_temporary", url.is_temporary)

            url.is_temporary = is_temporary


            url.save()
            return super().success_res(
                code="UPDATED",
                status_code=status.HTTP_200_OK,
                message="Sites Updated Successfully",
                data={"response": "Sites Updated Successfully"},
            )

        except Urls.DoesNotExist:
            return super().error_res(
                code="NOT_FOUND",
                error="Urls Not Found",
                message="Urls Not Found",
                status_code=status.HTTP_400_BAD_REQUEST,
            )
        except Exception as e:
            return super().error_res(
                code="TRY_AGAIN",
                error=f"An unexpected error occurred as {e}",
                message="An unexpected error occurred",
                status_code=status.HTTP_400_BAD_REQUEST,
            )


class AddCalenderView(APIView, BaseController):
    permission_classes = (AllowAny,)

    def put(self, request, id):
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

            url = Urls.objects.filter(user_id=user_info["id"]).get(id=id)
            request.data["user_id"] = user_info["id"]
            url.calender_url = request.data.get("calender_url", url.calender_url)

            url.save()
            return super().success_res(
                code="UPDATED",
                status_code=status.HTTP_200_OK,
                message="Sites Updated Successfully",
                data={"response": "Sites Updated Successfully"},
            )

        except Urls.DoesNotExist:
            return super().error_res(
                code="NOT_FOUND",
                error="Urls Not Found",
                message="Urls Not Found",
                status_code=status.HTTP_400_BAD_REQUEST,
            )
        except Exception as e:
            return super().error_res(
                code="TRY_AGAIN",
                error=f"An unexpected error occurred as {e}",
                message="An unexpected error occurred",
                status_code=status.HTTP_400_BAD_REQUEST,
            )


class ActiveUrlApi(APIView, BaseController):
    permission_classes = (AllowAny,)

    def put(self, request, id):
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
            url = Urls.objects.filter(user_id=user_info["id"]).get(id=id)
            user = User.objects.get(id=user_info["id"])
            subscriptions = Subscriptions.objects.select_related("sub_plan").get(
                user=user
            )
            subscription_plan = subscriptions.sub_plan
            if subscription_plan.plan == "FREE":
                current_time = timezone.now()
                if current_time > subscriptions.subcription_end_at:
                    return super().success_res(
                        code="Subscriptions Expired Try Premium Version",
                        data={"is_subcription_ended": True},
                        message="Subscriptions Expired Try Premium Version",
                        status_code=status.HTTP_400_BAD_REQUEST,
                    )
            if url.is_active:
                url.is_active = False
                url.save()
                return super().success_res(
                    code="DISABLED",
                    data={
                        "is_active": url.is_active,
                        "message": "Site Block Is Now Disabled",
                    },
                    status_code=status.HTTP_200_OK,
                )
            url.is_active = True
            url.save()
            return super().success_res(
                code="ENABLED",
                data={
                    "is_active": url.is_active,
                    "message": "Site Block Is Now Enabled",
                },
                status_code=status.HTTP_200_OK,
            )
        except Urls.DoesNotExist:
            return super().error_res(
                code="NOT_FOUND",
                error="Url Not Found",
                message="Url Not Found",
                status_code=status.HTTP_400_BAD_REQUEST,
            )
        except Exception as e:
            return super().error_res(
                code="TRY_AGAIN",
                error="Unexpected Error Occured",
                message=f"{e}",
                status_code=status.HTTP_400_BAD_REQUEST,
            )


class ScheduledTasksView(APIView, BaseController):
    permission_classes = (AllowAny,)

    def get(self, request):
        try:
            auth_header = request.headers.get("Authorization")
            print(auth_header)
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
            
            # Import here to avoid circular imports
            from django_celery_beat.models import PeriodicTask
            
            # Get tasks for this user
            user_tasks = PeriodicTask.objects.filter(
                name__contains=f"Reset URLs for user {user_info['id']}"
            ).values(
                'id', 'name', 'task', 'enabled', 'description', 'last_run_at'
            )

            # Add crontab information manually to avoid ZoneInfo serialization issues
            task_list = list(user_tasks)
            for task in task_list:
                # If the task has a last_run_at, convert it to string
                if task.get('last_run_at'):
                    task['last_run_at'] = task['last_run_at'].isoformat()
                
                # Get crontab information if it exists
                try:
                    crontab = PeriodicTask.objects.get(id=task['id']).crontab
                    if crontab:
                        task['crontab_hour'] = crontab.hour
                        task['crontab_minute'] = crontab.minute
                        # Convert timezone to string to avoid serialization issues
                        task['crontab_timezone'] = str(crontab.timezone) if crontab.timezone else 'Asia/Dhaka'
                except Exception as e:
                    print(f"Error getting crontab info: {e}")
                    task['crontab_hour'] = None
                    task['crontab_minute'] = None
                    task['crontab_timezone'] = None
            
            # Get user's timezone and convert to string to avoid serialization issues
            user = User.objects.get(id=user_info["id"])
            user_timezone = str(user.timezone) if user.timezone else 'Asia/Dhaka'
            
            # Get all URLs for this user
            urls = Urls.objects.filter(user_id=user_info["id"]).values(
                'id', 'block_urls', 'redirect_urls', 'is_active'
            )
            
            # If user has no URLs, delete any scheduled tasks
            if len(urls) == 0:
                # Find and delete any scheduled tasks for this user
                deleted_count = PeriodicTask.objects.filter(
                    name__contains=f"Reset URLs for user {user_info['id']}"
                ).delete()
                print(f"Deleted {deleted_count} tasks for user with no URLs")
                # Refresh the task list to be empty
                task_list = []
            
            # Even if there are URLs but no tasks, make sure we indicate this situation
            return super().success_res(
                code="SUCCESS",
                message="Scheduled Tasks Retrieved Successfully",
                status_code=status.HTTP_200_OK,
                data={
                    "tasks": task_list,
                    "user_timezone": user_timezone,
                    "url_count": len(urls),
                    "urls": list(urls),
                    "explanation": "A task is created to reset all your URLs every day at 12 PM in your timezone. URLs are added to or removed from this reset schedule automatically when you add or delete them.",
                    "has_urls_but_no_tasks": len(urls) > 0 and len(task_list) == 0, 
                    "action_required": len(urls) > 0 and len(task_list) == 0,
                    "action_message": "You have URLs but no scheduled tasks. Click 'Manual Reset' to trigger a reset and create a scheduled task."
                },
            )
        except Exception as e:
            return super().error_res(
                code="TRY_AGAIN",
                error=f"Unexpected Error Occurred: {e}",
                status_code=status.HTTP_400_BAD_REQUEST,
                message="Unexpected Error Occurred",
            )


class UpdateTimezoneView(APIView, BaseController):
    permission_classes = (AllowAny,)

    def put(self, request):
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
            
            # Get timezone from request or detect from IP
            timezone_name = request.data.get('timezone')
            if not timezone_name:
                client_ip = get_client_ip(request)
                timezone_name = get_timezone_from_ip(client_ip)
                
            if not timezone_name:
                return super().error_res(
                    code="INVALID_REQUEST",
                    status_code=status.HTTP_400_BAD_REQUEST,
                    error="Timezone could not be detected",
                    message="Please provide a timezone or enable IP detection",
                )
            
            # Update user's timezone
            user = User.objects.get(id=user_info["id"])
            user.timezone = timezone_name
            user.save()
            
            # Check if user has URLs before scheduling tasks
            url_count = Urls.objects.filter(user_id=user_info["id"]).count()
            
            # Reschedule the user's tasks with the new timezone only if they have URLs
            from urlshandler.tasks import schedule_reset_for_user
            task = schedule_reset_for_user.delay(user.id, timezone_name)
            task_id = task.id
            print(f"Task scheduled with ID: {task.id} after timezone update - Will be executed asynchronously")
            
            return super().success_res(
                code="SUCCESS",
                message="Timezone Updated Successfully",
                status_code=status.HTTP_200_OK,
                data={
                    "timezone": timezone_name,
                    "task_id": task_id,
                    "detected_from_ip": not request.data.get('timezone'),
                    "url_count": url_count,
                    "has_tasks": url_count > 0
                },
            )
        except Exception as e:
            return super().error_res(
                code="TRY_AGAIN",
                error=f"Unexpected Error Occurred: {e}",
                status_code=status.HTTP_400_BAD_REQUEST,
                message="Unexpected Error Occurred",
            )


class ManualResetUrls(APIView, BaseController):
    permission_classes = (AllowAny,)

    def post(self, request):
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
            
            # Import here to avoid circular imports
            from urlshandler.tasks import reset_user_urls, schedule_reset_for_user
            from django_celery_beat.models import PeriodicTask
            
            # Check if a scheduled task already exists
            existing_tasks = PeriodicTask.objects.filter(
                name__contains=f"Reset URLs for user {user_info['id']}"
            )
            has_existing_task = existing_tasks.exists()
            
            # Manually trigger URL reset for the user
            reset_task = reset_user_urls.delay(user_info["id"])
            
            # If no scheduled task exists, create one
            schedule_task = None
            if not has_existing_task:
                # Also create a scheduled task for future resets
                user = User.objects.get(id=user_info["id"])
                schedule_task = schedule_reset_for_user.delay(user.id, user.timezone if user.timezone else 'Asia/Dhaka')
                print(f"Created new scheduled task with ID: {schedule_task.id} because none existed")
            
            return super().success_res(
                code="SUCCESS",
                message="Reset Task Triggered Successfully",
                status_code=status.HTTP_200_OK,
                data={
                    "reset_task_id": reset_task.id,
                    "scheduled_task_created": schedule_task is not None,
                    "scheduled_task_id": schedule_task.id if schedule_task else None,
                    "had_existing_scheduled_task": has_existing_task
                },
            )
        except Exception as e:
            return super().error_res(
                code="TRY_AGAIN",
                error=f"Unexpected Error Occurred: {e}",
                status_code=status.HTTP_400_BAD_REQUEST,
                message="Unexpected Error Occurred",
            )


class ResetAllUrls(APIView, BaseController):
    permission_classes = (AllowAny,)

    def post(self, request):
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
            

            
            urls = Urls.objects.filter(user_id=user_info["id"])
            
            # Store daily usage data before reset
            total_time_used = urls.aggregate(total=Sum('used_time'))['total'] or 0
            visited_count = urls.filter(visited=True).count()
            
            # Save to UserActivity (create new entry each day, update only today)
            today = datetime.now().date()
            activity, created = UserActivity.objects.get_or_create(
                user_id=user_info["id"],
                date=today,
                defaults={
                    'urls_blocked': urls.count(),
                    'time_saved_minutes': total_time_used,
                    'sites_visited': visited_count
                }
            )
            
            # If entry already exists for today, update it
            if not created:
                activity.urls_blocked = urls.count()
                activity.time_saved_minutes = total_time_used
                activity.sites_visited = visited_count
                activity.save()
            
            url_list = []
            for url in urls:
                # Block if no time limit
                url.temporary_time = url.default_time
                url.today_limit = url.default_time
                url.visited = url.default_time == 0
                url.half_time_notified = False
                url.one_quarter_notified = False
                url.three_quarter_notified = False
                url.used_time = 0.0
                url.edit = False
                url.is_temporary = False
                url.save()
                url_list.append(url.block_urls)
            
            return super().success_res(
                code="SUCCESS",
                message="All URLs reset successfully",
                status_code=status.HTTP_200_OK,
                data={
                    "reset_count": len(url_list),
                    "urls": url_list
                },
            )
            
        except Exception as e:
            return super().error_res(
                code="TRY_AGAIN",
                error=f"Unexpected Error Occurred: {e}",
                status_code=status.HTTP_400_BAD_REQUEST,
                message="Unexpected Error Occurred",
            )