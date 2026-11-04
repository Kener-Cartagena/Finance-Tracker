from django.contrib import admin

from .models import BudgetItem, BudgetPlan, PlannedExpense


@admin.register(BudgetPlan)
class BudgetPlanAdmin(admin.ModelAdmin):
    list_display = ("user", "period_type", "custom_days", "expected_income", "expected_income_currency")


@admin.register(BudgetItem)
class BudgetItemAdmin(admin.ModelAdmin):
    list_display = ("user", "name", "item_type", "amount_type", "amount", "currency", "category", "is_active")
    list_filter = ("item_type", "amount_type", "is_active")


@admin.register(PlannedExpense)
class PlannedExpenseAdmin(admin.ModelAdmin):
    list_display = ("user", "name", "amount", "currency", "due_date", "is_emergency", "status")
    list_filter = ("status", "is_emergency", "category")
    search_fields = ("user__email", "name")
