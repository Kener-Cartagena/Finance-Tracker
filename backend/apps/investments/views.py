import django_filters
from rest_framework import viewsets
from rest_framework.decorators import action
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from .models import Investment, InvestmentType
from .serializers import InvestmentSerializer


class InvestmentFilter(django_filters.FilterSet):
    date_after = django_filters.DateFilter(field_name="date", lookup_expr="gte")
    date_before = django_filters.DateFilter(field_name="date", lookup_expr="lte")
    investment_type = django_filters.ChoiceFilter(choices=InvestmentType.choices)
    platform = django_filters.CharFilter(lookup_expr="icontains")

    class Meta:
        model = Investment
        fields = ["date_after", "date_before", "investment_type", "platform"]


class InvestmentViewSet(viewsets.ModelViewSet):
    """
    Standard CRUD for investments.
    Extra action:
        GET /api/investments/types/ → list available investment types
    """

    serializer_class = InvestmentSerializer
    permission_classes = [IsAuthenticated]
    filterset_class = InvestmentFilter
    search_fields = ["platform", "notes"]
    ordering_fields = ["date", "amount", "investment_type"]
    ordering = ["-date"]

    def get_queryset(self):
        return Investment.objects.filter(user=self.request.user)

    def perform_create(self, serializer):
        serializer.save(user=self.request.user)

    @action(detail=False, methods=["get"], url_path="types")
    def types(self, request):
        data = [{"value": v, "label": l} for v, l in InvestmentType.choices]
        return Response(data)
