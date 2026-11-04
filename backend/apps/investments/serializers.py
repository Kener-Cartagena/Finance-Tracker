from rest_framework import serializers

from apps.accounts.fields import MoneyRecordSerializerMixin
from .models import Investment


class InvestmentSerializer(MoneyRecordSerializerMixin, serializers.ModelSerializer):
    investment_type_display = serializers.CharField(
        source="get_investment_type_display", read_only=True
    )

    class Meta:
        model = Investment
        fields = (
            "id",
            "amount",
            "investment_type",
            "investment_type_display",
            "platform",
            "date",
            "notes",
            "created_at",
        ) + MoneyRecordSerializerMixin.MONEY_FIELDS
        read_only_fields = ("id", "created_at", "investment_type_display")

    def validate_amount(self, value):
        if value <= 0:
            raise serializers.ValidationError("Amount must be positive.")
        return value
