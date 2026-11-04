from django.conf import settings
from django.db import models

from apps.accounts.currency import Currency, DEFAULT_EXCHANGE_RATE


class ExpenseCategory(models.TextChoices):
    UNIVERSITY      = "university",     "Universidad"
    INTERNET        = "internet",       "Internet"
    TRANSPORT       = "transport",      "Transporte"
    GASOLINE        = "gasoline",       "Gasolina"
    FOOD            = "food",           "Comida"
    PERSONAL_CARE   = "personal_care",  "Cuidado personal"
    CLOTHING        = "clothing",       "Ropa"
    GIFTS           = "gifts",          "Regalos"
    FAMILY          = "family",         "Familia"
    ENTERTAINMENT   = "entertainment",  "Diversión"
    HEALTH          = "health",         "Salud"
    SUBSCRIPTIONS   = "subscriptions",  "Suscripciones"
    HOUSING         = "housing",        "Hogar"
    REPAIRS         = "repairs",        "Reparaciones"
    EMERGENCY       = "emergency",      "Emergencia"
    OTHER           = "other",          "Otro"


class Expense(models.Model):
    """
    A single expense record.

    - category: From the controlled ExpenseCategory vocabulary.
    - description: Human-readable detail of what was purchased.
    - date: The actual spend date.
    """

    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="expenses",
        db_index=True,
    )
    amount = models.DecimalField(max_digits=14, decimal_places=2)
    currency = models.CharField(max_length=3, choices=Currency.choices, default=Currency.HNL)
    exchange_rate = models.DecimalField(
        max_digits=10, decimal_places=4, default=DEFAULT_EXCHANGE_RATE,
        help_text="Lempiras por dólar al momento del registro.",
    )
    account = models.ForeignKey(
        "accounts.Account",
        on_delete=models.PROTECT,
        related_name="expenses",
        null=True,
        blank=True,
    )
    category = models.CharField(
        max_length=30,
        choices=ExpenseCategory.choices,
        default=ExpenseCategory.OTHER,
        db_index=True,
    )
    description = models.CharField(max_length=300, blank=True)
    date = models.DateField(db_index=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "expenses"
        ordering = ["-date", "-created_at"]
        indexes = [
            models.Index(fields=["user", "date"]),
            models.Index(fields=["user", "category"]),
        ]

    def __str__(self) -> str:
        return f"{self.user.email} | {self.category} | {self.amount}"
