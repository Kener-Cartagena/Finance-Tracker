from django.contrib import admin

from .models import Account, Transfer


@admin.register(Account)
class AccountAdmin(admin.ModelAdmin):
    list_display = ("user", "name", "kind", "currency", "initial_balance", "is_archived")
    list_filter = ("kind", "currency", "is_archived")
    search_fields = ("user__email", "name")


@admin.register(Transfer)
class TransferAdmin(admin.ModelAdmin):
    list_display = ("user", "from_account", "to_account", "amount", "amount_received", "date")
    list_filter = ("date",)
    search_fields = ("user__email", "notes")
