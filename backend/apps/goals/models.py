from django.db import models
from django.conf import settings


class Goal(models.Model):
    CATEGORY_CHOICES = [
        ('investment', 'Investment'),
        ('expense',    'Expense'),
    ]

    user           = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='goals',
    )
    name           = models.CharField(max_length=255)
    target_amount  = models.DecimalField(max_digits=14, decimal_places=2)
    current_amount = models.DecimalField(max_digits=14, decimal_places=2, default=0)
    deadline       = models.DateField(null=True, blank=True)
    is_completed   = models.BooleanField(default=False)
    category       = models.CharField(
        max_length=20,
        choices=CATEGORY_CHOICES,
        default='investment',
    )
    created_at     = models.DateTimeField(auto_now_add=True)
    updated_at     = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-created_at']
        indexes  = [models.Index(fields=['user'])]

    def __str__(self):
        return f'{self.name} ({self.user})'

    @property
    def progress_percentage(self):
        if not self.target_amount:
            return 0
        return round((self.current_amount / self.target_amount) * 100, 2)


class GoalContribution(models.Model):
    goal       = models.ForeignKey(Goal, on_delete=models.CASCADE, related_name='contributions')
    amount     = models.DecimalField(max_digits=14, decimal_places=2)
    date       = models.DateField()
    note       = models.CharField(max_length=500, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-date', '-created_at']

    def __str__(self):
        return f'{self.goal.name} +{self.amount} on {self.date}'
