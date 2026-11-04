from django.conf import settings
from django.db import models

from .currency import Currency


class AccountKind(models.TextChoices):
    BANK   = "bank",   "Banco"
    WALLET = "wallet", "Billetera digital"
    CASH   = "cash",   "Efectivo"
    OTHER  = "other",  "Otro"


class Account(models.Model):
    """
    A place where money lives (e.g. "Airtm", "Banco Atlántida", "Efectivo").
    Created by the user — nothing is predefined.

    Balance = initial_balance + incomes − expenses − investments
              + transfers in − transfers out
    (all in the account's own currency; see services.account_balances).
    """

    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="accounts",
    )
    name = models.CharField(max_length=100)
    kind = models.CharField(max_length=20, choices=AccountKind.choices, default=AccountKind.OTHER)
    currency = models.CharField(max_length=3, choices=Currency.choices, default=Currency.HNL)
    initial_balance = models.DecimalField(max_digits=14, decimal_places=2, default=0)
    notes = models.CharField(max_length=300, blank=True)
    is_archived = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "accounts"
        ordering = ["is_archived", "name"]
        constraints = [
            models.UniqueConstraint(fields=["user", "name"], name="unique_account_name_per_user"),
        ]

    def __str__(self) -> str:
        return f"{self.name} ({self.currency})"


class Transfer(models.Model):
    """
    Money moved between two of the user's accounts.
    When currencies differ it's a conversion: e.g. $200 from Airtm → L 5,200
    into Banco Atlántida. `amount_received` is what arrived (in the destination
    currency); the effective rate is amount_received / amount.
    """

    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="transfers",
    )
    from_account = models.ForeignKey(Account, on_delete=models.PROTECT, related_name="transfers_out")
    to_account = models.ForeignKey(Account, on_delete=models.PROTECT, related_name="transfers_in")
    amount = models.DecimalField(max_digits=14, decimal_places=2)
    amount_received = models.DecimalField(max_digits=14, decimal_places=2)
    date = models.DateField(db_index=True)
    notes = models.CharField(max_length=300, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "transfers"
        ordering = ["-date", "-created_at"]
        indexes = [models.Index(fields=["user", "date"])]

    def __str__(self) -> str:
        return f"{self.from_account} → {self.to_account}: {self.amount}"

    @property
    def effective_rate(self):
        if not self.amount:
            return None
        return round(self.amount_received / self.amount, 4)
