from rest_framework import serializers
from django.contrib.auth.password_validation import validate_password
from django.core.exceptions import ValidationError
from users.models import User
from django.contrib.auth.models import Group

class RegisterSerializer(serializers.ModelSerializer):
    password = serializers.CharField(write_only=True) 
    class Meta:
            model = User
            fields = ['first_name','last_name','email','password', 'timezone']

    def validate_password(self, value):
        try:
            validate_password(value)
        except ValidationError as e:
            raise serializers.ValidationError({'password': e.messages})
        return value

    def create(self,validated_data):
        user = User(
            first_name = validated_data['first_name'],
            last_name  = validated_data['last_name'],
            email = validated_data['email'],
            timezone = validated_data.get('timezone', 'Asia/Dhaka'),
            )
        user.set_password(validated_data['password'])
        user.save()
        user_group, created = Group.objects.get_or_create(name='USER')
        user_group.user_set.add(user)
        return user
    
class UserSerializer(serializers.ModelSerializer):
    groups = serializers.SerializerMethodField()

    def get_groups(self, obj):
        group_names = []
        for g in obj.groups.all():
            group_names.append(g.name)
        return group_names

    class Meta:
        model = User
        fields = ['id', 'email', 'first_name', 'last_name', 'phone_number', 'groups', 'timezone']

        
class LoginSerializer(serializers.Serializer):

    email = serializers.CharField(max_length=255, required=True, allow_null=False, allow_blank=False)
    password = serializers.CharField(max_length=255, write_only=True, allow_blank=False, allow_null=False)



class ChangePasswordSerializer(serializers.Serializer):
    old_password = serializers.CharField(required=True)
    new_password = serializers.CharField(required=True)

class ForgetPassWordSerializer(serializers.Serializer):
    email = serializers.EmailField(required=True) 

class VerifyCodeSerializer(serializers.Serializer):
    code = serializers.CharField(max_length=6)


class VerifyEmailSerializer(serializers.Serializer):
    email = serializers.EmailField(required=True)
    code = serializers.CharField(max_length=6)
