import django_filters
from .models import Expense, ExpenseCategory


class ExpenseFilter(django_filters.FilterSet):
    date_after = django_filters.DateFilter(field_name="date", lookup_expr="gte")
    date_before = django_filters.DateFilter(field_name="date", lookup_expr="lte")
    category = django_filters.ChoiceFilter(choices=ExpenseCategory.choices)
    description = django_filters.CharFilter(lookup_expr="icontains")

    class Meta:
        model = Expense
        fields = ["date_after", "date_before", "category", "description"]
