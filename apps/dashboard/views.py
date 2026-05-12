from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from . import services


class OverviewView(APIView):
    """
    GET /api/dashboard/overview/

    Returns the top-level financial snapshot:
      - net balance
      - total income / expenses ever
      - this month's income / expenses / savings
      - total invested
    """

    permission_classes = [IsAuthenticated]

    def get(self, request):
        data = services.get_overview(request.user)
        return Response(data)


class GoalsSummaryView(APIView):
    """
    GET /api/dashboard/goals/

    Returns progress for all goals: target, current, percentage, deadline.
    """

    permission_classes = [IsAuthenticated]

    def get(self, request):
        data = services.get_goals_summary(request.user)
        return Response(data)


class ExpensesByCategoryView(APIView):
    """
    GET /api/dashboard/statistics/expenses-by-category/
    Optional query params: ?year=2024&month=6

    Returns expense totals per category — ready for Chart.js pie/doughnut.
    """

    permission_classes = [IsAuthenticated]

    def get(self, request):
        year = request.query_params.get("year")
        month = request.query_params.get("month")
        data = services.get_expenses_by_category(
            user=request.user,
            year=int(year) if year else None,
            month=int(month) if month else None,
        )
        return Response(data)


class MonthlySummaryView(APIView):
    """
    GET /api/dashboard/statistics/monthly-summary/
    Optional: ?months=6 (default 12)

    Returns month-by-month income, expenses, savings — ready for line/bar charts.
    """

    permission_classes = [IsAuthenticated]

    def get(self, request):
        months = int(request.query_params.get("months", 12))
        data = services.get_monthly_income_vs_expenses(request.user, months=months)
        return Response(data)


class SavingsRateView(APIView):
    """
    GET /api/dashboard/statistics/savings-rate/

    Returns the current month's savings rate percentage.
    """

    permission_classes = [IsAuthenticated]

    def get(self, request):
        data = services.get_savings_rate(request.user)
        return Response(data)


class InvestmentsSummaryView(APIView):
    """
    GET /api/dashboard/statistics/investments/

    Returns total invested and a breakdown by investment type.
    """

    permission_classes = [IsAuthenticated]

    def get(self, request):
        data = services.get_investments_summary(request.user)
        return Response(data)
