from django.contrib import admin
from .models import Expense

@admin.register(Expense)
class ExpenseAdmin(admin.ModelAdmin):
    list_display = ("user", "category", "description", "amount", "date")
    list_filter = ("category", "date")
    search_fields = ("user__email", "description")
    ordering = ("-date",)
