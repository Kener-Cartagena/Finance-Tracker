from rest_framework import serializers

from apps.accounts.fields import MoneyRecordSerializerMixin
from .models import Income


class IncomeSerializer(MoneyRecordSerializerMixin, serializers.ModelSerializer):
    """
    Full serializer for list / retrieve / create / update.
    The `user` field is read-only and injected by the view's perform_create.
    """

    class Meta:
        model = Income
        fields = ("id", "amount", "source", "date", "notes", "created_at") + MoneyRecordSerializerMixin.MONEY_FIELDS
        read_only_fields = ("id", "created_at")

    def validate_amount(self, value):
        if value <= 0:
            raise serializers.ValidationError("Amount must be a positive number.")
        return value
