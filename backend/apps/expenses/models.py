from django.conf import settings
from django.db import models


class ExpenseCategory(models.TextChoices):
    UNIVERSITY      = "university",     "University"
    INTERNET        = "internet",       "Internet"
    TRANSPORT       = "transport",      "Transport"
    GASOLINE        = "gasoline",       "Gasoline"
    FOOD            = "food",           "Food"
    PERSONAL_CARE   = "personal_care",  "Personal Care"
    CLOTHING        = "clothing",       "Clothing"
    GIFTS           = "gifts",          "Gifts"
    FAMILY          = "family",         "Family"
    ENTERTAINMENT   = "entertainment",  "Entertainment"
    HEALTH          = "health",         "Health"
    SUBSCRIPTIONS   = "subscriptions",  "Subscriptions"
    HOUSING         = "housing",        "Housing"
    OTHER           = "other",          "Other"


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
