from django.contrib import admin
from .models import Investment

@admin.register(Investment)
class InvestmentAdmin(admin.ModelAdmin):
    list_display = ("user", "investment_type", "platform", "amount", "date")
    list_filter = ("investment_type",)
    search_fields = ("user__email", "platform", "notes")
    ordering = ("-date",)
