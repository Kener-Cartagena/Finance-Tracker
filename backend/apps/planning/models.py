from django.conf import settings
from django.db import models

from apps.accounts.currency import DEFAULT_EXCHANGE_RATE, Currency
from apps.expenses.models import ExpenseCategory


class PeriodType(models.TextChoices):
    BIWEEKLY = "biweekly", "Quincenal (1–15 y 16–fin de mes)"
    MONTHLY  = "monthly",  "Mensual"
    WEEKLY   = "weekly",   "Semanal"
    CUSTOM   = "custom",   "Cada N días"


class BudgetPlan(models.Model):
    """
    The user's budgeting configuration (one per user).

    - period_type / custom_days / anchor_date define how time is sliced.
      Weekly and custom periods are counted from anchor_date.
    - expected_income is used for the plan until real income for the
      period has been recorded.
    """

    user = models.OneToOneField(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="budget_plan",
    )
    period_type = models.CharField(max_length=20, choices=PeriodType.choices, default=PeriodType.BIWEEKLY)
    custom_days = models.PositiveSmallIntegerField(default=15)
    anchor_date = models.DateField(null=True, blank=True)
    expected_income = models.DecimalField(max_digits=14, decimal_places=2, null=True, blank=True)
    expected_income_currency = models.CharField(max_length=3, choices=Currency.choices, default=Currency.USD)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "budget_plans"

    def __str__(self) -> str:
        return f"{self.user} | {self.period_type}"


class BudgetItemType(models.TextChoices):
    FIXED      = "fixed",      "Gasto fijo"
    SAVINGS    = "savings",    "Ahorro / reserva"
    INVESTMENT = "investment", "Inversión"


class AmountType(models.TextChoices):
    FIXED   = "fixed",   "Monto fijo"
    PERCENT = "percent", "% del ingreso"


class BudgetItem(models.Model):
    """
    One line of the plan for EACH period, e.g.
      Universidad   fixed       L 2,400       (category=university)
      Gasolina      fixed       L 1,400       (category=gasoline)
      Reparaciones  savings     10 %
      Invertir      investment  $50
    `category` lets the plan compare what was budgeted vs what was actually
    spent in that category during the period.
    """

    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="budget_items",
    )
    name = models.CharField(max_length=100)
    item_type = models.CharField(max_length=20, choices=BudgetItemType.choices, default=BudgetItemType.FIXED)
    amount_type = models.CharField(max_length=10, choices=AmountType.choices, default=AmountType.FIXED)
    amount = models.DecimalField(max_digits=14, decimal_places=2)
    currency = models.CharField(max_length=3, choices=Currency.choices, default=Currency.HNL)
    category = models.CharField(max_length=30, choices=ExpenseCategory.choices, blank=True)
    is_active = models.BooleanField(default=True)
    order = models.PositiveIntegerField(default=0)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "budget_items"
        ordering = ["item_type", "order", "id"]

    def __str__(self) -> str:
        return f"{self.name} ({self.item_type})"


class PlannedExpenseStatus(models.TextChoices):
    PENDING   = "pending",   "Pendiente"
    PAID      = "paid",      "Pagado"
    CANCELLED = "cancelled", "Cancelado"


class PlannedExpense(models.Model):
    """
    A future or emergency expense you already know is coming
    (e.g. "Reparar frenos del carro" — L 3,500 — due 2026-11-20).

    While pending, it's reserved in the plan of the period where it's due
    (overdue ones are reserved in the current period). Marking it paid
    creates a real Expense and links it here.
    """

    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="planned_expenses",
    )
    name = models.CharField(max_length=200)
    amount = models.DecimalField(max_digits=14, decimal_places=2)
    currency = models.CharField(max_length=3, choices=Currency.choices, default=Currency.HNL)
    exchange_rate = models.DecimalField(max_digits=10, decimal_places=4, default=DEFAULT_EXCHANGE_RATE)
    due_date = models.DateField(db_index=True)
    is_emergency = models.BooleanField(default=False)
    category = models.CharField(max_length=30, choices=ExpenseCategory.choices, default=ExpenseCategory.REPAIRS)
    notes = models.TextField(blank=True)
    status = models.CharField(
        max_length=10, choices=PlannedExpenseStatus.choices, default=PlannedExpenseStatus.PENDING, db_index=True,
    )
    paid_expense = models.OneToOneField(
        "expenses.Expense",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="planned_source",
    )
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "planned_expenses"
        ordering = ["due_date", "-is_emergency", "id"]
        indexes = [models.Index(fields=["user", "status", "due_date"])]

    def __str__(self) -> str:
        return f"{self.name} | {self.amount} {self.currency} | {self.due_date}"
