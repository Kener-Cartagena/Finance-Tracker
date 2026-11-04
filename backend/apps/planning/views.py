from datetime import date

from django.db.models import Case, IntegerField, Value, When
from rest_framework import status, viewsets
from rest_framework.decorators import action
from rest_framework.exceptions import ValidationError
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.expenses.serializers import ExpenseSerializer

from . import services
from .models import AmountType, BudgetItem, BudgetItemType, PeriodType, PlannedExpense, PlannedExpenseStatus
from .serializers import (
    BudgetItemSerializer,
    BudgetPlanSerializer,
    PayPlannedExpenseSerializer,
    PlannedExpenseSerializer,
)


def _choices(enum):
    return [{"value": v, "label": l} for v, l in enum.choices]


class BudgetPlanView(APIView):
    """
    GET   /api/planning/plan/  → the user's plan settings (created on first access)
    PATCH /api/planning/plan/  → change period type, custom days, expected income…
    """

    permission_classes = [IsAuthenticated]

    def get(self, request):
        plan = services.get_plan(request.user)
        data = BudgetPlanSerializer(plan).data
        data["options"] = {
            "period_types": _choices(PeriodType),
            "item_types": _choices(BudgetItemType),
            "amount_types": _choices(AmountType),
        }
        return Response(data)

    def patch(self, request):
        plan = services.get_plan(request.user)
        serializer = BudgetPlanSerializer(plan, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response(serializer.data)


class BudgetSummaryView(APIView):
    """
    GET /api/planning/summary/?date=YYYY-MM-DD
    The plan for the period that contains `date` (default: today).
    """

    permission_classes = [IsAuthenticated]

    def get(self, request):
        raw = request.query_params.get("date")
        try:
            ref = date.fromisoformat(raw) if raw else None
        except ValueError:
            raise ValidationError({"date": "Formato de fecha inválido (usa YYYY-MM-DD)."})
        return Response(services.build_summary(request.user, ref))


class BudgetItemViewSet(viewsets.ModelViewSet):
    serializer_class = BudgetItemSerializer
    permission_classes = [IsAuthenticated]
    pagination_class = None
    filterset_fields = ["item_type", "is_active"]

    def get_queryset(self):
        return BudgetItem.objects.filter(user=self.request.user)

    def perform_create(self, serializer):
        serializer.save(user=self.request.user)


class PlannedExpenseViewSet(viewsets.ModelViewSet):
    """
    Future / emergency expenses.
        POST /api/planning/planned-expenses/{id}/pay/     → register the real expense
        POST /api/planning/planned-expenses/{id}/reopen/  → undo the payment
        POST /api/planning/planned-expenses/{id}/cancel/  → no longer needed
    """

    serializer_class = PlannedExpenseSerializer
    permission_classes = [IsAuthenticated]
    filterset_fields = ["status", "is_emergency", "category"]
    search_fields = ["name", "notes"]
    ordering_fields = ["due_date", "amount", "created_at"]

    def get_queryset(self):
        status_rank = Case(
            When(status=PlannedExpenseStatus.PENDING, then=Value(0)),
            When(status=PlannedExpenseStatus.PAID, then=Value(1)),
            default=Value(2),
            output_field=IntegerField(),
        )
        return (
            PlannedExpense.objects.filter(user=self.request.user)
            .select_related("paid_expense")
            .annotate(status_rank=status_rank)
            .order_by("status_rank", "due_date", "-is_emergency", "id")
        )

    def perform_create(self, serializer):
        serializer.save(user=self.request.user)

    @action(detail=True, methods=["post"])
    def pay(self, request, pk=None):
        planned = self.get_object()
        if planned.status != PlannedExpenseStatus.PENDING:
            return Response({"detail": "Este gasto ya no está pendiente."}, status=status.HTTP_400_BAD_REQUEST)

        body = PayPlannedExpenseSerializer(data=request.data, context={"request": request})
        body.is_valid(raise_exception=True)
        data = body.validated_data
        account = data.get("account")

        currency = account.currency if account else data.get("currency", planned.currency)
        if "amount" not in data and currency != planned.currency:
            return Response(
                {"amount": ["La cuenta está en otra moneda: indica el monto pagado en esa moneda."]},
                status=status.HTTP_400_BAD_REQUEST,
            )

        expense_data = {
            "amount": data.get("amount", planned.amount),
            "category": planned.category,
            "description": planned.name,
            "date": data.get("date", date.today()),
            "currency": currency,
            "account": account.id if account else None,
        }
        if "exchange_rate" in data:
            expense_data["exchange_rate"] = data["exchange_rate"]

        expense_serializer = ExpenseSerializer(data=expense_data, context={"request": request})
        expense_serializer.is_valid(raise_exception=True)
        services.mark_planned_paid(planned, expense_serializer)
        planned.refresh_from_db()
        return Response(self.get_serializer(planned).data)

    @action(detail=True, methods=["post"])
    def reopen(self, request, pk=None):
        planned = services.reopen_planned(self.get_object())
        planned.refresh_from_db()
        return Response(self.get_serializer(planned).data)

    @action(detail=True, methods=["post"])
    def cancel(self, request, pk=None):
        planned = self.get_object()
        if planned.status == PlannedExpenseStatus.PAID:
            return Response(
                {"detail": "Ya está pagado. Reábrelo primero si quieres cancelarlo."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        planned.status = PlannedExpenseStatus.CANCELLED
        planned.save(update_fields=["status"])
        return Response(self.get_serializer(planned).data)
