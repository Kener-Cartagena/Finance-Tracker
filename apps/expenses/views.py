from rest_framework import viewsets
from rest_framework.decorators import action
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from .models import Expense, ExpenseCategory
from .serializers import ExpenseSerializer, CategoryChoiceSerializer
from .filters import ExpenseFilter


class ExpenseViewSet(viewsets.ModelViewSet):
    """
    Standard CRUD for expenses.
    Extra action:
        GET /api/expenses/categories/ → list all valid categories
    """

    serializer_class = ExpenseSerializer
    permission_classes = [IsAuthenticated]
    filterset_class = ExpenseFilter
    search_fields = ["description"]
    ordering_fields = ["date", "amount", "category", "created_at"]
    ordering = ["-date"]

    def get_queryset(self):
        return Expense.objects.filter(user=self.request.user)

    def perform_create(self, serializer):
        serializer.save(user=self.request.user)

    @action(detail=False, methods=["get"], url_path="categories")
    def categories(self, request):
        """
        GET /api/expenses/categories/
        Returns the list of valid expense categories for UI dropdowns.
        """
        data = [
            {"value": value, "label": label}
            for value, label in ExpenseCategory.choices
        ]
        return Response(data)
