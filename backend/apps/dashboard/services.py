"""
Dashboard aggregations.

Every figure is reported in lempiras (USD records are converted with the
exchange rate stored on each record). Most functions accept an optional
date range (date_from / date_to, inclusive); without one they cover all time.
"""

from datetime import date
from decimal import Decimal
from typing import Optional

from django.db.models import Count, DecimalField, Q, Sum
from django.db.models.functions import Coalesce, TruncMonth

from apps.accounts.currency import ZERO, hnl_expression, sum_by_currency, sum_hnl, to_hnl
from apps.accounts.services import net_worth
from apps.expenses.models import Expense
from apps.goals.models import Goal
from apps.incomes.models import Income
from apps.investments.models import Investment
from apps.planning.models import PlannedExpense, PlannedExpenseStatus


def _range_q(date_from: Optional[date], date_to: Optional[date]) -> Q:
    q = Q()
    if date_from:
        q &= Q(date__gte=date_from)
    if date_to:
        q &= Q(date__lte=date_to)
    return q


def _hnl_sum_annotation():
    return Coalesce(Sum(hnl_expression()), ZERO, output_field=DecimalField(max_digits=20, decimal_places=2))


#  Overview

def get_overview(user, date_from: Optional[date] = None, date_to: Optional[date] = None) -> dict:
    """
    Top-level snapshot for the dashboard header.
    Called by: GET /api/dashboard/overview/?date_from=&date_to=
    """
    rng = _range_q(date_from, date_to)

    incomes = Income.objects.filter(user=user).filter(rng)
    expenses = Expense.objects.filter(user=user).filter(rng)
    investments = Investment.objects.filter(user=user).filter(rng)

    income = sum_hnl(incomes)
    spent = sum_hnl(expenses)
    invested = sum_hnl(investments)

    # All-time figures, independent from the filter.
    total_income_ever = sum_hnl(Income.objects.filter(user=user))
    total_expenses_ever = sum_hnl(Expense.objects.filter(user=user))
    total_invested_ever = sum_hnl(Investment.objects.filter(user=user))

    worth = net_worth(user)
    pending = PlannedExpense.objects.filter(user=user, status=PlannedExpenseStatus.PENDING)
    pending_hnl = sum((to_hnl(p.amount, p.currency, user.exchange_rate) for p in pending), Decimal("0"))

    return {
        "date_from": date_from,
        "date_to": date_to,
        "currency": "HNL",
        "exchange_rate": user.exchange_rate,
        # Filtered range
        "income": income,
        "income_by_currency": sum_by_currency(incomes),
        "expenses": spent,
        "expenses_by_currency": sum_by_currency(expenses),
        "invested": invested,
        "savings": income - spent - invested,
        "income_count": incomes.count(),
        "expense_count": expenses.count(),
        # All time
        "net_balance": total_income_ever - total_expenses_ever - total_invested_ever,
        "total_income_ever": total_income_ever,
        "total_expenses_ever": total_expenses_ever,
        "total_invested": total_invested_ever,
        # Money by place
        "accounts_total_hnl": worth["total_hnl"],
        "accounts_by_currency": worth["by_currency"],
        "accounts": [a for a in worth["accounts"] if not a["is_archived"]],
        # Upcoming
        "pending_planned_hnl": pending_hnl,
        "pending_planned_count": pending.count(),
    }


#  Goals

def get_goals_summary(user) -> list:
    """
    Returns progress for each goal.
    Called by: GET /api/dashboard/goals/
    """
    goals = Goal.objects.filter(user=user).order_by("-created_at")
    return [
        {
            "id": g.id,
            "name": g.name,
            "target_amount": g.target_amount,
            "current_amount": g.current_amount,
            "remaining_amount": g.target_amount - g.current_amount,
            "progress_percentage": g.progress_percentage,
            "deadline": g.deadline,
            "is_completed": g.is_completed,
        }
        for g in goals
    ]


#  Statistics

def get_expenses_by_category(
    user,
    date_from: Optional[date] = None,
    date_to: Optional[date] = None,
    year: Optional[int] = None,
    month: Optional[int] = None,
) -> list:
    """
    Expense totals (HNL) grouped by category.
    Called by: GET /api/dashboard/statistics/expenses-by-category/
    """
    qs = Expense.objects.filter(user=user).filter(_range_q(date_from, date_to))
    if year:
        qs = qs.filter(date__year=year)
    if month:
        qs = qs.filter(date__month=month)

    raw = (
        qs.order_by()
        .values("category")
        .annotate(total=_hnl_sum_annotation(), count=Count("id"))
        .order_by("-total")
    )
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


def get_monthly_income_vs_expenses(
    user,
    months: int = 12,
    date_from: Optional[date] = None,
    date_to: Optional[date] = None,
) -> list:
    """
    Month-by-month income / expenses / savings in HNL.
    With a date range: every month inside it. Without: the last N months with data.
    Called by: GET /api/dashboard/statistics/monthly-summary/
    """
    rng = _range_q(date_from, date_to)

    def by_month(model):
        return (
            model.objects.filter(user=user)
            .filter(rng)
            .annotate(month=TruncMonth("date"))
            .order_by()
            .values("month")
            .annotate(total=_hnl_sum_annotation())
        )

    data: dict = {}
    for kind, model in (("income", Income), ("expenses", Expense)):
        for row in by_month(model):
            key = row["month"].strftime("%Y-%m")
            data.setdefault(key, {"month": key, "income": ZERO, "expenses": ZERO})
            data[key][kind] = row["total"]

    result = sorted(data.values(), key=lambda x: x["month"])
    for entry in result:
        entry["savings"] = entry["income"] - entry["expenses"]

    if date_from or date_to:
        return result
    return result[-months:]


def get_savings_rate(user, date_from: Optional[date] = None, date_to: Optional[date] = None) -> dict:
    """
    Savings rate for the range (default: current month).
    Called by: GET /api/dashboard/statistics/savings-rate/
    """
    if not (date_from or date_to):
        today = date.today()
        date_from, date_to = today.replace(day=1), today
    rng = _range_q(date_from, date_to)

    income = sum_hnl(Income.objects.filter(user=user).filter(rng))
    expenses = sum_hnl(Expense.objects.filter(user=user).filter(rng))
    rate = Decimal("0") if income == 0 else round(((income - expenses) / income) * 100, 2)

    return {
        "date_from": date_from,
        "date_to": date_to,
        "income": income,
        "expenses": expenses,
        "savings": income - expenses,
        "savings_rate_percent": rate,
    }


def get_investments_summary(user, date_from: Optional[date] = None, date_to: Optional[date] = None) -> dict:
    """
    Investment totals (HNL) grouped by type.
    Called by: GET /api/dashboard/statistics/investments/
    """
    qs = Investment.objects.filter(user=user).filter(_range_q(date_from, date_to))
    by_type = (
        qs.order_by()
        .values("investment_type")
        .annotate(total=_hnl_sum_annotation(), count=Count("id"))
        .order_by("-total")
    )
    label_map = dict(Investment._meta.get_field("investment_type").choices)

    return {
        "total_invested": sum_hnl(qs),
        "breakdown": [
            {
                "type": row["investment_type"],
                "label": label_map.get(row["investment_type"], row["investment_type"]),
                "total": row["total"],
                "count": row["count"],
            }
            for row in by_type
        ],
    }
