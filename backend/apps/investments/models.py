from django.conf import settings
from django.db import models

from apps.accounts.currency import Currency, DEFAULT_EXCHANGE_RATE


class InvestmentType(models.TextChoices):
    STOCKS  = "stocks",  "Stocks"
    CRYPTO  = "crypto",  "Cryptocurrency"
    BONDS   = "bonds",   "Bonds"
    ETF     = "etf",     "ETF"
    REAL_ESTATE = "real_estate", "Real Estate"
    OTHER   = "other",   "Other"


class Investment(models.Model):
    """
    Tracks a single investment entry.

    - platform: e.g. "Robinhood", "Coinbase", "Fidelity"
    - investment_type: controlled vocabulary via InvestmentType.
    - amount: the amount of money invested (cost basis, not current value).
    - notes: ticker symbol, asset name, etc.
    """

    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="investments",
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
        related_name="investments",
        null=True,
        blank=True,
    )
    investment_type = models.CharField(
        max_length=30,
        choices=InvestmentType.choices,
        default=InvestmentType.OTHER,
        db_index=True,
    )
    platform = models.CharField(max_length=100)
    date = models.DateField(db_index=True)
    notes = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "investments"
        ordering = ["-date"]
        indexes = [
            models.Index(fields=["user", "date"]),
            models.Index(fields=["user", "investment_type"]),
        ]

    def __str__(self) -> str:
        return f"{self.user.email} | {self.investment_type} | {self.amount}"
