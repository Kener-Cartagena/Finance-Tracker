import django_filters
from .models import Income


class IncomeFilter(django_filters.FilterSet):
    date_after = django_filters.DateFilter(field_name="date", lookup_expr="gte")
    date_before = django_filters.DateFilter(field_name="date", lookup_expr="lte")
    source = django_filters.CharFilter(lookup_expr="icontains")

    class Meta:
        model = Income
        fields = ["date_after", "date_before", "source"]
