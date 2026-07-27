from rest_framework import serializers
from subscriptions.models import SubscriptionPlan, Subscriptions
from users.models import User

class UserSubcriptionsUpdateSerializer(serializers.ModelSerializer):
    sub_plan_id = serializers.IntegerField(required=True)
    user_id = serializers.IntegerField(required=True)
    
    class Meta:
        model = Subscriptions
        fields = ["sub_plan_id", "user_id"]

    def create(self, validated_data):
        sub_plan = SubscriptionPlan.objects.get(id=validated_data["sub_plan_id"])
        user = User.objects.get(id=validated_data["user_id"])
        
        # Check if the subscription already exists
        if Subscriptions.objects.filter(sub_plan=sub_plan, user=user).exists():
            raise serializers.ValidationError("User is already subscribed to this plan.")

        # Create a new subscription
        user_subscription = Subscriptions(sub_plan=sub_plan, user=user)
        user_subscription.save()
        return user_subscription

    def update(self, instance, validated_data):
        sub_plan = SubscriptionPlan.objects.get(id=validated_data["sub_plan_id"])
        user = User.objects.get(id=validated_data["user_id"])

        instance.sub_plan = sub_plan
        instance.user = user
        instance.save()
        return instance
        
class UserSubscriptionSerializer(serializers.Serializer):

    subcription_id = serializers.IntegerField()
    plan = serializers.CharField(max_length=20)
    plan_duartion = serializers.IntegerField()
    max_url_storage = serializers.IntegerField()
    price = serializers.FloatField()
    subscription_start_at = serializers.DateTimeField()


 
