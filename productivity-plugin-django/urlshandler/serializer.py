from rest_framework import serializers
from urlshandler.models import Urls
from users.models import User
from users.utils import decode_token


class UrlSerializer(serializers.ModelSerializer):
    block_urls = serializers.CharField(required=False,allow_blank=True)
    redirect_urls = serializers.CharField(required=False,allow_blank=True)

    visited = serializers.BooleanField(required=False, default=False)
    used_time = serializers.FloatField(required=False, default=0.0)
    half_time_notified = serializers.BooleanField(required=False, default=False)
    one_quarter_notified = serializers.BooleanField(required=False, default=False)
    three_quarter_notified = serializers.BooleanField(required=False, default=False)
    is_temporary = serializers.BooleanField(required=False, default=False)
    default_time=serializers.IntegerField(required=False, default=0)
    calender_url=serializers.CharField(required=False,allow_blank=True)
    message=serializers.CharField(required=False,allow_blank=True)
    edit=serializers.BooleanField(required=False, default=False)
    image = serializers.ImageField(required=False, allow_null=True)  # Add image field
    timezone = serializers.CharField(required=False, max_length=50, write_only=True)  # Add timezone field as write_only
    temporary_time = serializers.IntegerField(required=False, allow_null=True)  # Add temporary_time field
    today_limit = serializers.IntegerField(required=False, default=0)
    class Meta:
        model = Urls
        fields = ['user_id', 'block_urls', 'redirect_urls',
                 'visited', 'used_time', 'half_time_notified', 'one_quarter_notified',
                 'three_quarter_notified', 'is_temporary', 'default_time','calender_url','message','edit','image','timezone','temporary_time','today_limit']

    def create(self, validated_data):
        # Remove timezone from validated_data before creating the URL
        timezone = validated_data.pop('timezone', None)
        if 'minutes_to_unblock' in validated_data:
            validated_data['default_time'] = validated_data['minutes_to_unblock']
        urls = Urls(**validated_data)
        urls.save()
        return urls
    
    def update(self, instance, validated_data):
        for attr, value in validated_data.items():
            setattr(instance, attr, value)
        instance.save()
        return instance

class UpdateUrlsSerializer(serializers.Serializer):
    block_urls = serializers.CharField(required=False,allow_blank=True)
    redirect_urls = serializers.CharField(required=False,allow_blank=True)

    visited = serializers.BooleanField(required=False)
    used_time = serializers.FloatField(required=False)
    half_time_notified = serializers.BooleanField(required=False)
    one_quarter_notified = serializers.BooleanField(required=False)
    three_quarter_notified = serializers.BooleanField(required=False)
    is_temporary = serializers.BooleanField(required=False, default=False)
    default_time=serializers.IntegerField(required=False, default=0)
    calender_url=serializers.CharField(required=False,allow_blank=True)
    message=serializers.CharField(required=False,allow_blank=True)
    edit=serializers.BooleanField(required=False, default=False)
    image = serializers.ImageField(required=False, allow_null=True)  # Add image field
    timezone = serializers.CharField(required=False, max_length=50)  # Add timezone field
    temporary_time = serializers.IntegerField(required=False, allow_null=True)  # Add temporary_time field
    today_limit = serializers.IntegerField(required=False, default=0)