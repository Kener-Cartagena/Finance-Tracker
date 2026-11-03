from django.contrib import admin
from .models import Income

@admin.register(Income)
class IncomeAdmin(admin.ModelAdmin):
    list_display = ("user", "source", "amount", "date", "created_at")
    list_filter = ("date",)
    search_fields = ("user__email", "source")
    ordering = ("-date",)
