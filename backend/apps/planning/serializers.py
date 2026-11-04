from datetime import date
from decimal import Decimal

from rest_framework import serializers

from apps.accounts.currency import Currency, to_hnl
from apps.accounts.fields import UserAccountField

from .models import AmountType, BudgetItem, BudgetItemType, BudgetPlan, PeriodType, PlannedExpense


class BudgetPlanSerializer(serializers.ModelSerializer):
    period_type_display = serializers.CharField(source="get_period_type_display", read_only=True)

    class Meta:
        model = BudgetPlan
        fields = (
            "period_type", "period_type_display", "custom_days", "anchor_date",
            "expected_income", "expected_income_currency", "updated_at",
        )
        read_only_fields = ("updated_at", "period_type_display")

    def validate_custom_days(self, value):
        if not 1 <= value <= 366:
            raise serializers.ValidationError("Debe estar entre 1 y 366 días.")
        return value

    def validate_expected_income(self, value):
        if value is not None and value < 0:
            raise serializers.ValidationError("No puede ser negativo.")
        return value

    def validate(self, attrs):
        ptype = attrs.get("period_type", getattr(self.instance, "period_type", None))
        anchor = attrs.get("anchor_date", getattr(self.instance, "anchor_date", None))
        if ptype in (PeriodType.WEEKLY, PeriodType.CUSTOM) and anchor is None:
            # Start counting from today unless the user picks a start date.
            attrs["anchor_date"] = date.today()
        return attrs


class BudgetItemSerializer(serializers.ModelSerializer):
    item_type_display = serializers.CharField(source="get_item_type_display", read_only=True)
    category_display = serializers.CharField(source="get_category_display", read_only=True)

    class Meta:
        model = BudgetItem
        fields = (
            "id", "name", "item_type", "item_type_display", "amount_type", "amount",
            "currency", "category", "category_display", "is_active", "order", "created_at",
        )
        read_only_fields = ("id", "created_at", "item_type_display", "category_display")

    def validate(self, attrs):
        amount_type = attrs.get("amount_type", getattr(self.instance, "amount_type", AmountType.FIXED))
        amount = attrs.get("amount", getattr(self.instance, "amount", None))
        item_type = attrs.get("item_type", getattr(self.instance, "item_type", BudgetItemType.FIXED))

        if amount is not None:
            if amount <= 0:
                raise serializers.ValidationError({"amount": "Debe ser mayor que 0."})
            if amount_type == AmountType.PERCENT and amount > 100:
                raise serializers.ValidationError({"amount": "Un porcentaje no puede pasar de 100."})
        if item_type != BudgetItemType.FIXED:
            attrs["category"] = ""
        return attrs


class PlannedExpenseSerializer(serializers.ModelSerializer):
    category_display = serializers.CharField(source="get_category_display", read_only=True)
    status_display = serializers.CharField(source="get_status_display", read_only=True)
    exchange_rate = serializers.DecimalField(
        max_digits=10, decimal_places=4, required=False, min_value=Decimal("0.0001")
    )
    amount_hnl = serializers.SerializerMethodField()
    days_until_due = serializers.SerializerMethodField()
    paid_date = serializers.DateField(source="paid_expense.date", read_only=True, default=None)
    paid_amount = serializers.DecimalField(
        source="paid_expense.amount", max_digits=14, decimal_places=2, read_only=True, default=None
    )

    class Meta:
        model = PlannedExpense
        fields = (
            "id", "name", "amount", "currency", "exchange_rate", "amount_hnl",
            "due_date", "days_until_due", "is_emergency", "category", "category_display",
            "notes", "status", "status_display", "paid_expense", "paid_date", "paid_amount", "created_at",
        )
        read_only_fields = ("id", "status", "paid_expense", "created_at")

    def get_amount_hnl(self, obj):
        # Pending items are valued at today's rate; that's what they'll cost.
        request = self.context.get("request")
        rate = request.user.exchange_rate if request else obj.exchange_rate
        return to_hnl(obj.amount, obj.currency, rate)

    def get_days_until_due(self, obj):
        return (obj.due_date - date.today()).days

    def validate_amount(self, value):
        if value <= 0:
            raise serializers.ValidationError("Debe ser mayor que 0.")
        return value

    def validate(self, attrs):
        if self.instance is None and "exchange_rate" not in attrs:
            attrs["exchange_rate"] = self.context["request"].user.exchange_rate
        return attrs


class PayPlannedExpenseSerializer(serializers.Serializer):
    """Body of POST /api/planning/planned-expenses/{id}/pay/ — all optional."""

    date = serializers.DateField(required=False)
    amount = serializers.DecimalField(max_digits=14, decimal_places=2, required=False)
    account = UserAccountField(required=False, allow_null=True)
    currency = serializers.ChoiceField(choices=Currency.choices, required=False)
    exchange_rate = serializers.DecimalField(
        max_digits=10, decimal_places=4, required=False, min_value=Decimal("0.0001")
    )
