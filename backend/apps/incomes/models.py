from django.conf import settings
from django.db import models


class Income(models.Model):
    """
    A single income record.

    - user: ForeignKey to the owning user (deleted cascade keeps DB clean).    
    """

    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="incomes",
        db_index=True,
    )
    amount = models.DecimalField(max_digits=14, decimal_places=2)
    source = models.CharField(max_length=200)
    date = models.DateField(db_index=True)
    notes = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "incomes"
        ordering = ["-date", "-created_at"]
        indexes = [
            models.Index(fields=["user", "date"]),
        ]

    def __str__(self) -> str:
        return f"{self.user.email} | {self.source} | {self.amount}"
