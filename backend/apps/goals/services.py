from decimal import Decimal
from django.db import transaction
from .models import Goal, GoalContribution
from apps.expenses.models import Expense


class GoalContributionService:

    @staticmethod
    @transaction.atomic
    def contribute(goal: Goal, amount: Decimal, date, note: str = ''):
        """
        Adds funds to a goal and handles side effects:
        - category == 'investment': no balance impact (same as before).
        - category == 'expense':    creates an Expense record so the
          amount is automatically deducted from the net balance in the
          dashboard.
        """
        amount = Decimal(str(amount))

        # 1. Create contribution record
        contribution = GoalContribution.objects.create(
            goal=goal,
            amount=amount,
            date=date,
            note=note,
        )

        # 2. Update goal's current_amount
        goal.current_amount += amount
        if goal.current_amount >= goal.target_amount:
            goal.is_completed   = True
            goal.current_amount = goal.target_amount
        goal.save(update_fields=['current_amount', 'is_completed', 'updated_at'])

        # 3. If expense category, deduct from net balance via Expense record
        if goal.category == 'expense':
            Expense.objects.create(
                user=goal.user,
                amount=amount,
                category='other',
                description=f'Goal: {goal.name}',
                date=date,
            )

        return contribution, goal
