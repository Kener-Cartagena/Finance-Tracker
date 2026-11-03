from rest_framework import viewsets
from rest_framework.permissions import IsAuthenticated

from .models import Income
from .serializers import IncomeSerializer
from .filters import IncomeFilter


class IncomeViewSet(viewsets.ModelViewSet):
    """
    list    → GET  /api/incomes/
    create  → POST /api/incomes/
    retrieve→ GET  /api/incomes/{id}/
    update  → PUT  /api/incomes/{id}/
    partial → PATCH /api/incomes/{id}/
    destroy → DELETE /api/incomes/{id}/
    """

    serializer_class = IncomeSerializer
    permission_classes = [IsAuthenticated]
    filterset_class = IncomeFilter
    search_fields = ["source", "notes"]
    ordering_fields = ["date", "amount", "created_at"]
    ordering = ["-date"]

    def get_queryset(self):
        """
        Always scope to the requesting user.
        This is the single most important security line in the app.
        """
        return Income.objects.filter(user=self.request.user)

    def perform_create(self, serializer):
        """Inject the authenticated user before saving."""
        serializer.save(user=self.request.user)
