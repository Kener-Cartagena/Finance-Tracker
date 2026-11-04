from rest_framework import serializers

from apps.accounts.fields import MoneyRecordSerializerMixin
from .models import Expense, ExpenseCategory


class ExpenseSerializer(MoneyRecordSerializerMixin, serializers.ModelSerializer):
    category_display = serializers.CharField(
        source="get_category_display", read_only=True
    )

    class Meta:
        model = Expense
        fields = (
            "id",
            "amount",
            "category",
            "category_display",
            "description",
            "date",
            "created_at",
        ) + MoneyRecordSerializerMixin.MONEY_FIELDS
        read_only_fields = ("id", "created_at", "category_display")

    def validate_amount(self, value):
        if value <= 0:
            raise serializers.ValidationError("Amount must be a positive number.")
        return value


class CategoryChoiceSerializer(serializers.Serializer):
    """
    Returns available categories — useful for populating dropdowns in the UI.
    GET /api/expenses/categories/
    """

    value = serializers.CharField()
    label = serializers.CharField()
