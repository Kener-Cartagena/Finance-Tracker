"""
Serializer mixin shared by every money record (Income, Expense, Investment,
PlannedExpense): currency, exchange rate and optional account.

Rules
- If an account is given, the record's currency is forced to the account's.
- If no exchange_rate is sent on create, the user's current rate is used.
- The account must belong to the requesting user.
"""

from decimal import Decimal

from rest_framework import serializers

from .currency import Currency, to_hnl
from .models import Account


class UserAccountField(serializers.PrimaryKeyRelatedField):
    def get_queryset(self):
        request = self.context.get("request")
        if request is None or not request.user.is_authenticated:
            return Account.objects.none()
        return Account.objects.filter(user=request.user)


class MoneyRecordSerializerMixin(serializers.Serializer):
    currency = serializers.ChoiceField(choices=Currency.choices, required=False)
    exchange_rate = serializers.DecimalField(
        max_digits=10, decimal_places=4, required=False, min_value=Decimal("0.0001")
    )
    account = UserAccountField(required=False, allow_null=True)
    account_name = serializers.CharField(source="account.name", read_only=True, default=None)
    amount_hnl = serializers.SerializerMethodField()

    MONEY_FIELDS = ("currency", "exchange_rate", "account", "account_name", "amount_hnl")

    def get_amount_hnl(self, obj):
        return to_hnl(obj.amount, obj.currency, obj.exchange_rate)

    def validate(self, attrs):
        attrs = super().validate(attrs)
        account = attrs.get("account", getattr(self.instance, "account", None))
        if account is not None:
            attrs["currency"] = account.currency
        elif "currency" not in attrs and self.instance is None:
            attrs["currency"] = Currency.HNL

        if "exchange_rate" not in attrs and self.instance is None:
            request = self.context.get("request")
            attrs["exchange_rate"] = request.user.exchange_rate
        return attrs
