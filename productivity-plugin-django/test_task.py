#!/usr/bin/env python
import os
import django

# Setup Django
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'productivity_plugin_api.settings')
django.setup()

from urlshandler.tasks import schedule_reset_for_user
from users.models import User
from urlshandler.models import Urls

# Get user 5
try:
    user = User.objects.get(id=5)
    print(f"User: {user.email}, Timezone: {user.timezone}")
    
    # Check URLs
    urls = Urls.objects.filter(user_id=5)
    print(f"URLs count: {urls.count()}")
    for url in urls:
        print(f"  - {url.block_urls}")
    
    # Call the task directly (not async)
    print("\nCalling schedule_reset_for_user directly...")
    result = schedule_reset_for_user(5, user.timezone or 'Asia/Dhaka')
    print(f"Result: {result}")
    
except Exception as e:
    print(f"Error: {e}")
    import traceback
    traceback.print_exc()