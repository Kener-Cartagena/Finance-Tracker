from rest_framework import serializers
from .models import Goal, GoalContribution


class GoalContributionSerializer(serializers.ModelSerializer):
    class Meta:
        model  = GoalContribution
        fields = ['id', 'amount', 'date', 'note', 'created_at']
        read_only_fields = ['created_at']


class GoalSerializer(serializers.ModelSerializer):
    progress_percentage = serializers.SerializerMethodField()
    category_display    = serializers.CharField(source='get_category_display', read_only=True)

    class Meta:
        model  = Goal
        fields = [
            'id', 'name', 'target_amount', 'current_amount',
            'deadline', 'is_completed', 'progress_percentage',
            'category', 'category_display', 'created_at',
        ]
        read_only_fields = ['current_amount', 'is_completed', 'created_at']

    def get_progress_percentage(self, obj):
        if not obj.target_amount:
            return 0
        return round(float(obj.current_amount) / float(obj.target_amount) * 100, 2)

    def validate_category(self, value):
        if value not in ('investment', 'expense'):
            raise serializers.ValidationError("Category must be 'investment' or 'expense'.")
        return value
