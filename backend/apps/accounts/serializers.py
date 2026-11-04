from rest_framework import serializers

from .fields import UserAccountField
from .models import Account, Transfer


def has_movements(account: Account) -> bool:
    return (
        account.incomes.exists()
        or account.expenses.exists()
        or account.investments.exists()
        or account.transfers_in.exists()
        or account.transfers_out.exists()
    )


class AccountSerializer(serializers.ModelSerializer):
    kind_display = serializers.CharField(source="get_kind_display", read_only=True)

    class Meta:
        model = Account
        fields = (
            "id", "name", "kind", "kind_display", "currency",
            "initial_balance", "notes", "is_archived", "created_at",
        )
        read_only_fields = ("id", "created_at", "kind_display")
        # Uniqueness per user is checked in validate_name (with a friendly message).
        validators = []

    def validate_name(self, value):
        value = value.strip()
        if not value:
            raise serializers.ValidationError("El nombre es obligatorio.")
        user = self.context["request"].user
        qs = Account.objects.filter(user=user, name__iexact=value)
        if self.instance:
            qs = qs.exclude(pk=self.instance.pk)
        if qs.exists():
            raise serializers.ValidationError("Ya tienes una cuenta con ese nombre.")
        return value

    def validate_currency(self, value):
        # Changing an account's currency would silently reinterpret its history.
        if self.instance and value != self.instance.currency and has_movements(self.instance):
            raise serializers.ValidationError(
                "No puedes cambiar la moneda de una cuenta que ya tiene movimientos."
            )
        return value


class TransferSerializer(serializers.ModelSerializer):
    from_account = UserAccountField()
    to_account = UserAccountField()
    amount_received = serializers.DecimalField(max_digits=14, decimal_places=2, required=False)
    from_account_name = serializers.CharField(source="from_account.name", read_only=True)
    to_account_name = serializers.CharField(source="to_account.name", read_only=True)
    from_currency = serializers.CharField(source="from_account.currency", read_only=True)
    to_currency = serializers.CharField(source="to_account.currency", read_only=True)
    effective_rate = serializers.DecimalField(max_digits=12, decimal_places=4, read_only=True)

    class Meta:
        model = Transfer
        fields = (
            "id", "from_account", "from_account_name", "from_currency",
            "to_account", "to_account_name", "to_currency",
            "amount", "amount_received", "effective_rate",
            "date", "notes", "created_at",
        )
        read_only_fields = ("id", "created_at")

    def validate(self, attrs):
        src = attrs.get("from_account", getattr(self.instance, "from_account", None))
        dst = attrs.get("to_account", getattr(self.instance, "to_account", None))
        amount = attrs.get("amount", getattr(self.instance, "amount", None))

        if src == dst:
            raise serializers.ValidationError({"to_account": "Elige una cuenta distinta a la de origen."})
        if amount is not None and amount <= 0:
            raise serializers.ValidationError({"amount": "El monto debe ser mayor que 0."})

        received = attrs.get("amount_received")
        if received is None:
            if self.instance is None or "amount" in attrs:
                if src.currency != dst.currency:
                    raise serializers.ValidationError({
                        "amount_received": "Indica cuánto llegó a la cuenta destino (cambio de moneda)."
                    })
                attrs["amount_received"] = amount
        elif received <= 0:
            raise serializers.ValidationError({"amount_received": "El monto debe ser mayor que 0."})
        elif src.currency == dst.currency and received != amount:
            raise serializers.ValidationError({
                "amount_received": "Entre cuentas de la misma moneda, el monto recibido debe ser igual al enviado."
            })
        return attrs
