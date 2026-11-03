"""
URL patterns for dashboard and statistics endpoints.
All are GET-only; they aggregate data without modifying state.
"""

from django.urls import path
from .views import (
    OverviewView,
    GoalsSummaryView,
    ExpensesByCategoryView,
    MonthlySummaryView,
    SavingsRateView,
    InvestmentsSummaryView,
)

urlpatterns = [
    # Dashboard
    path("overview/",                       OverviewView.as_view(),             name="dashboard-overview"),
    path("goals/",                          GoalsSummaryView.as_view(),         name="dashboard-goals"),

    # Statistics
    path("statistics/expenses-by-category/", ExpensesByCategoryView.as_view(), name="stats-expenses-category"),
    path("statistics/monthly-summary/",      MonthlySummaryView.as_view(),      name="stats-monthly-summary"),
    path("statistics/savings-rate/",         SavingsRateView.as_view(),         name="stats-savings-rate"),
    path("statistics/investments/",          InvestmentsSummaryView.as_view(),  name="stats-investments"),
]
