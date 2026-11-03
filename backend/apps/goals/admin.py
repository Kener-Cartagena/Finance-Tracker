from django.contrib import admin
from .models import Goal, GoalContribution

@admin.register(Goal)
class GoalAdmin(admin.ModelAdmin):
    list_display = ("user", "name", "target_amount", "current_amount", "is_completed", "deadline")
    list_filter = ("is_completed",)
    search_fields = ("user__email", "name")

@admin.register(GoalContribution)
class GoalContributionAdmin(admin.ModelAdmin):
    list_display = ("goal", "amount", "date", "note")
    ordering = ("-date",)
