"""
Budget plan engine: "this period you got X, you must pay Y, save Z,
invest W — you can spend V on fun".

All figures are in lempiras. Fixed amounts in USD (budget items, upcoming
expenses, expected income) are converted at the user's current rate; real
records (incomes, expenses, investments) use the rate stored with each one.
"""

from collections import defaultdict
from datetime import date
from decimal import ROUND_HALF_UP, Decimal

from django.db import transaction
from django.db.models import Q

from apps.accounts.currency import CENT, ZERO, sum_by_currency, sum_hnl, to_hnl
from apps.expenses.models import Expense, ExpenseCategory
from apps.incomes.models import Income
from apps.investments.models import Investment

from .models import (
    AmountType,
    BudgetItem,
    BudgetItemType,
    BudgetPlan,
    PlannedExpense,
    PlannedExpenseStatus,
)
from .periods import next_period, period_for, previous_period

CATEGORY_LABELS = dict(ExpenseCategory.choices)


def _q(value) -> Decimal:
    return Decimal(value).quantize(CENT, ROUND_HALF_UP)


def get_plan(user) -> BudgetPlan:
    plan, _ = BudgetPlan.objects.get_or_create(user=user)
    return plan


def build_summary(user, ref: date | None = None) -> dict:
    today = date.today()
    ref = ref or today
    plan = get_plan(user)
    period = period_for(plan, ref)
    rate = user.exchange_rate
    in_period = Q(date__gte=period.start, date__lte=period.end)

    #  Income
    incomes = Income.objects.filter(user=user).filter(in_period)
    received = sum_hnl(incomes)
    expected = (
        to_hnl(plan.expected_income, plan.expected_income_currency, rate)
        if plan.expected_income
        else None
    )
    basis = max(received, expected or ZERO)
    income = {
        "received_hnl": received,
        "received_by_currency": sum_by_currency(incomes),
        "expected_hnl": expected,
        "pending_hnl": max((expected or ZERO) - received, ZERO),
        "basis_hnl": basis,
        "basis_source": "actual" if received >= (expected or ZERO) and received > 0
                        else ("expected" if expected else "none"),
    }

    #  Expenses in the period
    expenses = Expense.objects.filter(user=user).filter(in_period)
    regular = expenses.filter(planned_source__isnull=True)
    planned_paid_qs = expenses.filter(planned_source__isnull=False)

    #  Plan items
    items = list(BudgetItem.objects.filter(user=user, is_active=True))
    fixed_categories = {i.category for i in items if i.item_type == BudgetItemType.FIXED and i.category}
    spent_by_cat = {cat: sum_hnl(regular.filter(category=cat)) for cat in fixed_categories}

    planned_by_cat = defaultdict(lambda: ZERO)
    item_rows = []
    totals = defaultdict(lambda: ZERO)
    for it in items:
        if it.amount_type == AmountType.PERCENT:
            planned = _q(basis * it.amount / 100)
        else:
            planned = to_hnl(it.amount, it.currency, rate)

        spent = None
        if it.item_type == BudgetItemType.FIXED and it.category:
            spent = spent_by_cat[it.category]
            planned_by_cat[it.category] += planned

        totals[f"{it.item_type}_planned"] += planned
        item_rows.append({
            "id": it.id,
            "name": it.name,
            "item_type": it.item_type,
            "item_type_display": it.get_item_type_display(),
            "amount_type": it.amount_type,
            "amount": it.amount,
            "currency": it.currency,
            "category": it.category,
            "category_display": CATEGORY_LABELS.get(it.category, ""),
            "planned_hnl": planned,
            "spent_hnl": spent,
            "remaining_hnl": None if spent is None else planned - spent,
        })

    # A fixed item commits whichever is bigger: what you budgeted or what you
    # actually spent in its category (overspending eats into fun money).
    fixed_committed = sum(
        (r["planned_hnl"] for r in item_rows if r["item_type"] == BudgetItemType.FIXED and not r["category"]),
        ZERO,
    ) + sum((max(planned_by_cat[c], spent_by_cat[c]) for c in fixed_categories), ZERO)
    fixed_spent = sum(spent_by_cat.values(), ZERO)

    investment_actual = sum_hnl(Investment.objects.filter(user=user).filter(in_period))
    investment_committed = max(totals["investment_planned"], investment_actual)

    #  Upcoming / emergency expenses still pending
    pending = PlannedExpense.objects.filter(user=user, status=PlannedExpenseStatus.PENDING)
    if period.contains(today):
        # The current period also has to cover anything overdue.
        pending = pending.filter(due_date__lte=period.end)
    else:
        pending = pending.filter(due_date__gte=period.start, due_date__lte=period.end)
    upcoming = [
        {
            "id": p.id,
            "name": p.name,
            "amount": p.amount,
            "currency": p.currency,
            "amount_hnl": to_hnl(p.amount, p.currency, rate),
            "due_date": p.due_date,
            "is_emergency": p.is_emergency,
            "is_overdue": p.due_date < today,
        }
        for p in pending.order_by("due_date")
    ]
    upcoming_reserved = sum((u["amount_hnl"] for u in upcoming), ZERO)
    planned_paid = sum_hnl(planned_paid_qs)

    #  Fun money
    variable = regular.exclude(category__in=fixed_categories)
    variable_spent = sum_hnl(variable)
    committed_total = (
        fixed_committed + totals["savings_planned"] + investment_committed + upcoming_reserved + planned_paid
    )
    available = basis - committed_total
    remaining = available - variable_spent

    if today > period.end:
        days_left = 0
    else:
        days_left = (period.end - max(today, period.start)).days + 1
    per_day = _q(remaining / days_left) if days_left and remaining > 0 else ZERO

    variable_by_category = sorted(
        (
            {"category": cat, "label": CATEGORY_LABELS.get(cat, cat), "total": sum_hnl(variable.filter(category=cat))}
            for cat in set(variable.values_list("category", flat=True))
        ),
        key=lambda r: r["total"],
        reverse=True,
    )

    prev_p, next_p = previous_period(plan, period), next_period(plan, period)
    return {
        "period": {
            "type": plan.period_type,
            "label": period.label,
            "start": period.start,
            "end": period.end,
            "days": period.days,
            "days_left": days_left,
            "is_current": period.contains(today),
            "prev_date": prev_p.start,
            "next_date": next_p.start,
        },
        "exchange_rate": rate,
        "income": income,
        "items": item_rows,
        "totals": {
            "fixed_planned": totals["fixed_planned"],
            "fixed_spent": fixed_spent,
            "fixed_committed": fixed_committed,
            "savings_planned": totals["savings_planned"],
            "investment_planned": totals["investment_planned"],
            "investment_actual": investment_actual,
            "investment_committed": investment_committed,
            "upcoming_reserved": upcoming_reserved,
            "planned_paid": planned_paid,
            "committed_total": committed_total,
            "expenses_total": sum_hnl(expenses),
        },
        "upcoming": upcoming,
        "fun": {
            "available": available,
            "spent": variable_spent,
            "remaining": remaining,
            "per_day": per_day,
        },
        "variable_by_category": variable_by_category,
    }


#  Planned expenses → real expenses

@transaction.atomic
def mark_planned_paid(planned: PlannedExpense, expense_serializer) -> Expense:
    """Save the (already validated) expense and link it to the planned expense."""
    expense = expense_serializer.save(user=planned.user)
    planned.status = PlannedExpenseStatus.PAID
    planned.paid_expense = expense
    planned.save(update_fields=["status", "paid_expense"])
    return expense


@transaction.atomic
def reopen_planned(planned: PlannedExpense) -> PlannedExpense:
    """Undo a payment: delete the generated expense and mark it pending again."""
    if planned.paid_expense_id:
        expense = planned.paid_expense
        planned.paid_expense = None
        planned.save(update_fields=["paid_expense"])
        expense.delete()
    planned.status = PlannedExpenseStatus.PENDING
    planned.save(update_fields=["status"])
    return planned
