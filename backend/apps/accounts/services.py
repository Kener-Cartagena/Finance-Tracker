"""Account balances and the user's net worth in lempiras."""

from collections import defaultdict
from decimal import Decimal

from django.db.models import Sum

from apps.expenses.models import Expense
from apps.incomes.models import Income
from apps.investments.models import Investment

from .currency import ZERO, to_hnl
from .models import Account, Transfer


def _totals_by_account(queryset, field="amount", key="account_id") -> dict:
    rows = (
        queryset.exclude(**{f"{key}__isnull": True})
        .order_by()
        .values(key)
        .annotate(total=Sum(field))
    )
    return {r[key]: r["total"] or ZERO for r in rows}


def account_balances(user, include_archived: bool = True) -> list:
    """
    One dict per account with its native balance and its value in lempiras
    (USD balances are valued at the user's *current* exchange rate).
    """
    accounts = Account.objects.filter(user=user)
    if not include_archived:
        accounts = accounts.filter(is_archived=False)

    incomes = _totals_by_account(Income.objects.filter(user=user))
    expenses = _totals_by_account(Expense.objects.filter(user=user))
    investments = _totals_by_account(Investment.objects.filter(user=user))
    transfers = Transfer.objects.filter(user=user)
    t_out = _totals_by_account(transfers, "amount", "from_account_id")
    t_in = _totals_by_account(transfers, "amount_received", "to_account_id")

    rate = user.exchange_rate
    result = []
    for a in accounts:
        movements = {
            "incomes": incomes.get(a.id, ZERO),
            "expenses": expenses.get(a.id, ZERO),
            "investments": investments.get(a.id, ZERO),
            "transfers_in": t_in.get(a.id, ZERO),
            "transfers_out": t_out.get(a.id, ZERO),
        }
        balance = (
            a.initial_balance
            + movements["incomes"]
            - movements["expenses"]
            - movements["investments"]
            + movements["transfers_in"]
            - movements["transfers_out"]
        )
        result.append({
            "id": a.id,
            "name": a.name,
            "kind": a.kind,
            "kind_display": a.get_kind_display(),
            "currency": a.currency,
            "initial_balance": a.initial_balance,
            "notes": a.notes,
            "is_archived": a.is_archived,
            "balance": balance,
            "balance_hnl": to_hnl(balance, a.currency, rate),
            "movements": movements,
        })
    return result


def net_worth(user) -> dict:
    """Total money across (non-archived) accounts, in lempiras and per currency."""
    balances = account_balances(user)
    active = [b for b in balances if not b["is_archived"]]
    by_currency = defaultdict(lambda: ZERO)
    for b in active:
        by_currency[b["currency"]] += b["balance"]
    return {
        "total_hnl": sum((b["balance_hnl"] for b in active), Decimal("0")),
        "by_currency": {"HNL": by_currency["HNL"], "USD": by_currency["USD"]},
        "exchange_rate": user.exchange_rate,
        "accounts": balances,
    }
