import json
import asyncio
from channels.generic.websocket import AsyncWebsocketConsumer
from channels.db import database_sync_to_async


class UrlListConsumer(AsyncWebsocketConsumer):
    async def connect(self):
        self.user_id = self.scope['url_route']['kwargs']['user_id']
        await self.accept()

    async def disconnect(self, close_code):
        # Clean up any pending tasks
        try:
            pass
        except Exception:
            pass

    async def receive(self, text_data):
        try:
            # Add timeout to prevent hanging
            data = json.loads(text_data)
            action = data.get('action')
            
            if action == 'get_urls':
                await asyncio.wait_for(self.get_urls(data), timeout=10.0)
            else:
                await self.send(text_data=json.dumps({
                    'error': 'Invalid action'
                }))
        except asyncio.TimeoutError:
            await self.send(text_data=json.dumps({
                'error': 'Request timeout'
            }))
        except Exception as e:
            await self.send(text_data=json.dumps({
                'error': str(e)
            }))

    async def get_urls(self, data):
        try:
            from users.utils import decode_token
            
            token = data.get('token')
            if not token:
                await self.send(text_data=json.dumps({
                    'error': 'Token required'
                }))
                return

            user_info = await database_sync_to_async(decode_token)(token)
            if user_info is False:
                await self.send(text_data=json.dumps({
                    'error': 'Invalid or expired token'
                }))
                return

            if str(user_info['id']) != str(self.user_id):
                await self.send(text_data=json.dumps({
                    'error': 'Unauthorized access'
                }))
                return

            urls = await self.get_user_urls(self.user_id)
            await self.send(text_data=json.dumps({
                'action': 'urls_list',
                'data': {'urls': urls}
            }))
        except Exception as e:
            await self.send(text_data=json.dumps({
                'error': str(e)
            }))

    @database_sync_to_async
    def get_user_urls(self, user_id):
        from urlshandler.models import Urls
        return list(Urls.objects.filter(user_id=user_id).values(
            "id", "block_urls", "redirect_urls", "visited", "used_time",
            "half_time_notified", "one_quarter_notified", "three_quarter_notified",
            "default_time", "is_active", "calender_url", "message", "edit",
            "is_temporary", "image", "temporary_time", "today_limit"
        ))


class UrlUpdateConsumer(AsyncWebsocketConsumer):
    async def connect(self):
        self.url_id = self.scope['url_route']['kwargs']['url_id']
        await self.accept()

    async def disconnect(self, close_code):
        # Clean up any pending tasks
        try:
            pass
        except Exception:
            pass

    async def receive(self, text_data):
        try:
            # Add timeout to prevent hanging
            data = json.loads(text_data)
            action = data.get('action')
            
            if action == 'update_url':
                await asyncio.wait_for(self.update_url(data), timeout=10.0)
            else:
                await self.send(text_data=json.dumps({
                    'error': 'Invalid action'
                }))
        except asyncio.TimeoutError:
            await self.send(text_data=json.dumps({
                'error': 'Request timeout'
            }))
        except Exception as e:
            await self.send(text_data=json.dumps({
                'error': str(e)
            }))

    async def update_url(self, data):
        try:
            from users.utils import decode_token
            
            token = data.get('token')
            update_data = data.get('update_data', {})

            if not token:
                await self.send(text_data=json.dumps({
                    'error': 'Token required'
                }))
                return

            user_info = await database_sync_to_async(decode_token)(token)
            if user_info is False:
                await self.send(text_data=json.dumps({
                    'error': 'Invalid or expired token'
                }))
                return

            updated_url = await self.update_user_url(user_info['id'], self.url_id, update_data)
            if updated_url:
                await self.send(text_data=json.dumps({
                    'action': 'url_updated',
                    'data': updated_url
                }))
            else:
                await self.send(text_data=json.dumps({
                    'error': 'URL not found or unauthorized'
                }))
        except Exception as e:
            await self.send(text_data=json.dumps({
                'error': str(e)
            }))

    @database_sync_to_async
    def update_user_url(self, user_id, url_id, update_data):
        try:
            from urlshandler.models import Urls
            from urlshandler.serializer import UpdateUrlsSerializer
            
            url = Urls.objects.get(id=url_id, user_id=user_id)
            serializer = UpdateUrlsSerializer(data=update_data, partial=True)
            if serializer.is_valid():
                for attr, value in serializer.validated_data.items():
                    if attr != 'timezone':  # Skip timezone as it's not a URL field
                        setattr(url, attr, value)
                url.save()
                return {
                    "id": url.id,
                    "block_urls": url.block_urls,
                    "redirect_urls": url.redirect_urls,
                    "visited": url.visited,
                    "used_time": url.used_time,
                    "half_time_notified": url.half_time_notified,
                    "one_quarter_notified": url.one_quarter_notified,
                    "three_quarter_notified": url.three_quarter_notified,
                    "default_time": url.default_time,
                    "is_active": url.is_active,
                    "calender_url": url.calender_url,
                    "message": url.message,
                    "edit": url.edit,
                    "is_temporary": url.is_temporary,
                    "temporary_time": url.temporary_time,
                    "today_limit": url.today_limit
                }
            return None
        except Exception:
            return None