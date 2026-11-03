from decimal import Decimal
from datetime import date
from typing import Optional

from django.db.models import Sum, Count, Q
from django.db.models.functions import TruncMonth

from apps.incomes.models import Income
from apps.expenses.models import Expense
from apps.goals.models import Goal
from apps.investments.models import Investment


def _sum_or_zero(queryset, field: str = "amount") -> Decimal:
    """Helper: return aggregate sum or Decimal('0') when no records exist."""
    result = queryset.aggregate(total=Sum(field))["total"]
    return result if result is not None else Decimal("0")


#  Overview 

def get_overview(user) -> dict:
    """
    Returns the top-level financial snapshot for the dashboard header.
    Called by: GET /api/dashboard/overview/
    """
    today = date.today()
    current_month = Q(date__year=today.year, date__month=today.month)

    total_income_ever = _sum_or_zero(Income.objects.filter(user=user))
    total_expenses_ever = _sum_or_zero(Expense.objects.filter(user=user))
    total_invested = _sum_or_zero(Investment.objects.filter(user=user))

    income_this_month = _sum_or_zero(Income.objects.filter(user=user).filter(current_month))
    expenses_this_month = _sum_or_zero(Expense.objects.filter(user=user).filter(current_month))

    net_balance = total_income_ever - total_expenses_ever - total_invested
    savings_this_month = income_this_month - expenses_this_month

    return {
        "net_balance": net_balance,
        "total_income_ever": total_income_ever,
        "total_expenses_ever": total_expenses_ever,
        "total_invested": total_invested,
        "income_this_month": income_this_month,
        "expenses_this_month": expenses_this_month,
        "savings_this_month": savings_this_month,
        "month": today.strftime("%B %Y"),
    }


#  Goals 

def get_goals_summary(user) -> list:
    """
    Returns progress for each active goal.
    Called by: GET /api/dashboard/goals/
    """
    goals = Goal.objects.filter(user=user).order_by("-created_at")
    return [
        {
            "id": g.id,
            "name": g.name,
            "target_amount": g.target_amount,
            "current_amount": g.current_amount,
            "remaining_amount": float(g.target_amount) - float(g.current_amount),
            "progress_percentage": g.progress_percentage,
            "deadline": g.deadline,
            "is_completed": g.is_completed,
        }
        for g in goals
    ]


#  Statistics 

def get_expenses_by_category(user, year: Optional[int] = None, month: Optional[int] = None) -> list:
    """
    Returns expense totals grouped by category.
    Supports optional filtering by year and/or month.
    Called by: GET /api/dashboard/statistics/expenses-by-category/
    Optimized for Chart.js pie/doughnut charts.

    Response shape:
    [
        {"category": "food", "label": "Food", "total": 320.00, "count": 12},
        ...
    ]
    """
    qs = Expense.objects.filter(user=user)
    if year:
        qs = qs.filter(date__year=year)
    if month:
        qs = qs.filter(date__month=month)

    raw = (
        qs.values("category")
        .annotate(total=Sum("amount"), count=Count("id"))
        .order_by("-total")
    )

    # Build a label lookup from the TextChoices
    label_map = dict(Expense._meta.get_field("category").choices)

    return [
        {
            "category": row["category"],
            "label": label_map.get(row["category"], row["category"]),
            "total": row["total"],
            "count": row["count"],
        }
        for row in raw
    ]


def get_monthly_income_vs_expenses(user, months: int = 12) -> list:
    """
    Returns month-by-month income and expense totals for the last N months.
    Called by: GET /api/dashboard/statistics/monthly-summary/
    Optimized for Chart.js bar/line charts.

    Response shape:
    [
        {"month": "2024-01", "income": 3000.00, "expenses": 1800.00, "savings": 1200.00},
        ...
    ]
    """
    income_by_month = (
        Income.objects.filter(user=user)
        .annotate(month=TruncMonth("date"))
        .values("month")
        .annotate(total=Sum("amount"))
        .order_by("month")
    )

    expense_by_month = (
        Expense.objects.filter(user=user)
        .annotate(month=TruncMonth("date"))
        .values("month")
        .annotate(total=Sum("amount"))
        .order_by("month")
    )

    # Merge into a single dict keyed by month strig
    data: dict = {}

    for row in income_by_month:
        key = row["month"].strftime("%Y-%m")
        data.setdefault(key, {"month": key, "income": Decimal("0"), "expenses": Decimal("0")})
        data[key]["income"] = row["total"]

    for row in expense_by_month:
        key = row["month"].strftime("%Y-%m")
        data.setdefault(key, {"month": key, "income": Decimal("0"), "expenses": Decimal("0")})
        data[key]["expenses"] = row["total"]

    result = sorted(data.values(), key=lambda x: x["month"])
    # Add savings column
    for entry in result:
        entry["savings"] = entry["income"] - entry["expenses"]

    return result[-months:]  # last N months


def get_savings_rate(user) -> dict:
    """
    Returns the overall savings rate: (income - expenses) / income * 100
    Called by: GET /api/dashboard/statistics/savings-rate/
    """
    today = date.today()
    current_month = Q(date__year=today.year, date__month=today.month)

    income = _sum_or_zero(Income.objects.filter(user=user).filter(current_month))
    expenses = _sum_or_zero(Expense.objects.filter(user=user).filter(current_month))

    if income == 0:
        rate = Decimal("0")
    else:
        rate = round(((income - expenses) / income) * 100, 2)

    return {
        "month": today.strftime("%B %Y"),
        "income": income,
        "expenses": expenses,
        "savings": income - expenses,
        "savings_rate_percent": rate,
    }


def get_investments_summary(user) -> dict:
    """
    Returns investment totals grouped by type.
    Called by: GET /api/dashboard/statistics/investments/
    """
    by_type = (
        Investment.objects.filter(user=user)
        .values("investment_type")
        .annotate(total=Sum("amount"), count=Count("id"))
        .order_by("-total")
    )

    label_map = dict(Investment._meta.get_field("investment_type").choices)
    total = _sum_or_zero(Investment.objects.filter(user=user))

    breakdown = [
        {
            "type": row["investment_type"],
            "label": label_map.get(row["investment_type"], row["investment_type"]),
            "total": row["total"],
            "count": row["count"],
        }
        for row in by_type
    ]

    return {
        "total_invested": total,
        "breakdown": breakdown,
    }
