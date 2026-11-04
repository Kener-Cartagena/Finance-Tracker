from django.urls import include, path
from rest_framework.routers import DefaultRouter

from .views import BudgetItemViewSet, BudgetPlanView, BudgetSummaryView, PlannedExpenseViewSet

router = DefaultRouter()
router.register(r"items", BudgetItemViewSet, basename="budget-item")
router.register(r"planned-expenses", PlannedExpenseViewSet, basename="planned-expense")

urlpatterns = [
    path("plan/", BudgetPlanView.as_view(), name="budget-plan"),
    path("summary/", BudgetSummaryView.as_view(), name="budget-summary"),
    path("", include(router.urls)),
]
