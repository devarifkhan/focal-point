from django.test import TestCase
from django.utils import timezone
from rest_framework.test import APIClient
from django.urls import reverse
from unittest.mock import patch
from users.models import User
from urlshandler.models import Urls 
from subscriptions.models import SubscriptionPlan
from datetime import timedelta

class LoginAPITest(TestCase):

    def setUp(self):
        self.client = APIClient()
        self.url = reverse('login')  
        self.subscription_plan = SubscriptionPlan.objects.create(
            plan='FREE',
            plan_duartion = 7,
            max_url_storage= 3,
            price=0.0
        )
        self.user = User.objects.create_user(
            first_name ="Asif",
            last_name ="fahim",
            email='asif@gmail.com',
            password='password'
        )
        self.site1 = Urls.objects.create(
            user_id = self.user,
            block_urls="www.google.com",
            redirect_urls="www.yahoo.com",
            minutes_to_unblock=3
        )
        self.site2 = Urls.objects.create(
            user_id = self.user,
            block_urls="www.facebook.com",
            redirect_urls="www.medium.com",
            minutes_to_unblock=3
        )
        self.site3 = Urls.objects.create(
            user_id = self.user,
            block_urls="www.google.com",
            redirect_urls="www.news.com",
            minutes_to_unblock=3
        )

        self.data = {
            'email': 'asif@gmail.com',
            'password': 'password'
        }
        self.response = self.client.post(self.url, self.data, format='json')
        
    

    @patch('urlshandler.views.timezone') 
    def test_toogle_diasbles(self, mock_datetime):
        mock_datetime.now.return_value = timezone.now() + timedelta(days=7, seconds=45)
        data = {
                'email': 'asif@gmail.com',
                'password': 'password'
        }
        response = self.client.post(self.url, data, format='json')
        self.assertEqual(response.status_code, 200)
        toogle_url  = reverse('activate_deactivate_url',kwargs={'id':2})
        token = f"Bearer "+ response.data['data']['access_token']
        print(self.site2)
        header = {"AUTHORIZATION":token}
        self.site2.refresh_from_db()
        response2 = self.client.put(toogle_url,headers=header)
        print(response2.data)

        

    @patch('urlshandler.views.timezone') 
    def test_token_expired_after_60_minutes(self, mock_datetime):

        mock_datetime.now.return_value = timezone.now() + timedelta(minutes=90, seconds=2)
        new_payload = {
           "block_url":"www.django.com",
           "redirect_url":"www.bitcoin.com",
           "minutes_to_unblock":5
        }
        add_url = reverse('add_url')
        token = f"Bearer "+ self.response.data['data']['access_token']
        header = {"AUTHORIZATION":token}
        res2 = self.client.post(add_url,new_payload,headers=header)
        print(res2.data)
        
      



        
