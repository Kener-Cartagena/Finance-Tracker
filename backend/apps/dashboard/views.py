from datetime import date

from rest_framework.exceptions import ValidationError
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from . import services


def _parse_date(params, key):
    raw = params.get(key)
    if not raw:
        return None
    try:
        return date.fromisoformat(raw)
    except ValueError:
        raise ValidationError({key: "Formato de fecha inválido (usa YYYY-MM-DD)."})


def _parse_int(params, key, default=None):
    raw = params.get(key)
    if raw in (None, ""):
        return default
    try:
        return int(raw)
    except ValueError:
        raise ValidationError({key: "Debe ser un número entero."})


class DateRangeMixin:
    """Reads optional ?date_from=YYYY-MM-DD&date_to=YYYY-MM-DD (inclusive)."""

    def date_range(self, request):
        date_from = _parse_date(request.query_params, "date_from")
        date_to = _parse_date(request.query_params, "date_to")
        if date_from and date_to and date_from > date_to:
            raise ValidationError({"date_from": "La fecha inicial no puede ser mayor que la final."})
        return {"date_from": date_from, "date_to": date_to}


class OverviewView(DateRangeMixin, APIView):
    """
    GET /api/dashboard/overview/?date_from=&date_to=

    Income / expenses / invested / savings for the range (HNL), all-time net
    balance, money per account and pending upcoming expenses.
    """

    permission_classes = [IsAuthenticated]

    def get(self, request):
        return Response(services.get_overview(request.user, **self.date_range(request)))


class GoalsSummaryView(APIView):
    """GET /api/dashboard/goals/ — progress for all goals."""

    permission_classes = [IsAuthenticated]

    def get(self, request):
        return Response(services.get_goals_summary(request.user))


class ExpensesByCategoryView(DateRangeMixin, APIView):
    """
    GET /api/dashboard/statistics/expenses-by-category/
    Optional: ?date_from=&date_to=  or legacy ?year=2024&month=6
    """

    permission_classes = [IsAuthenticated]

    def get(self, request):
        data = services.get_expenses_by_category(
            request.user,
            year=_parse_int(request.query_params, "year"),
            month=_parse_int(request.query_params, "month"),
            **self.date_range(request),
        )
        return Response(data)


class MonthlySummaryView(DateRangeMixin, APIView):
    """
    GET /api/dashboard/statistics/monthly-summary/
    Optional: ?months=6 (default 12) or ?date_from=&date_to=
    """

    permission_classes = [IsAuthenticated]

    def get(self, request):
        months = _parse_int(request.query_params, "months", 12)
        data = services.get_monthly_income_vs_expenses(request.user, months=months, **self.date_range(request))
        return Response(data)


class SavingsRateView(DateRangeMixin, APIView):
    """GET /api/dashboard/statistics/savings-rate/ — default: current month."""

    permission_classes = [IsAuthenticated]

    def get(self, request):
        return Response(services.get_savings_rate(request.user, **self.date_range(request)))


class InvestmentsSummaryView(DateRangeMixin, APIView):
    """GET /api/dashboard/statistics/investments/ — totals by type (HNL)."""

    permission_classes = [IsAuthenticated]

    def get(self, request):
        return Response(services.get_investments_summary(request.user, **self.date_range(request)))
