"""
Shared currency helpers (USD / HNL).

Every money record stores its native `currency` plus the `exchange_rate`
(lempiras per dollar) that applied when it was recorded. Totals are always
reported in lempiras: USD amounts are multiplied by their own stored rate,
so historical totals don't move when the user updates the current rate.
"""

from decimal import Decimal, ROUND_HALF_UP

from django.db import models
from django.db.models import Case, DecimalField, ExpressionWrapper, F, Sum, Value, When
from django.db.models.functions import Coalesce

DEFAULT_EXCHANGE_RATE = Decimal("26.00")
ZERO = Decimal("0")
CENT = Decimal("0.01")


class Currency(models.TextChoices):
    HNL = "HNL", "Lempiras"
    USD = "USD", "Dólares"


def to_hnl(amount, currency: str, rate) -> Decimal:
    """Convert a single amount to lempiras."""
    amount = Decimal(str(amount or 0))
    if currency == Currency.USD:
        return (amount * Decimal(str(rate))).quantize(CENT, ROUND_HALF_UP)
    return amount


def hnl_expression(amount_field: str = "amount"):
    """ORM expression: the row's amount expressed in lempiras."""
    return ExpressionWrapper(
        Case(
            When(currency=Currency.USD, then=F(amount_field) * F("exchange_rate")),
            default=F(amount_field),
        ),
        output_field=DecimalField(max_digits=20, decimal_places=4),
    )


def sum_hnl(queryset, amount_field: str = "amount") -> Decimal:
    """Aggregate a queryset of money records into a lempira total."""
    total = queryset.aggregate(
        total=Coalesce(
            Sum(hnl_expression(amount_field)),
            Value(ZERO),
            output_field=DecimalField(max_digits=20, decimal_places=4),
        )
    )["total"]
    return Decimal(total).quantize(CENT, ROUND_HALF_UP)


def sum_by_currency(queryset, amount_field: str = "amount") -> dict:
    """Native totals per currency, e.g. {"USD": Decimal("500"), "HNL": Decimal("1200")}."""
    result = {c: ZERO for c in Currency.values}
    for row in queryset.values("currency").annotate(total=Sum(amount_field)):
        result[row["currency"]] = row["total"] or ZERO
    return result
