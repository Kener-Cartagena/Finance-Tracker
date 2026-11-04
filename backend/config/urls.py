"""
Root URL configuration.
Each app is responsible for its own url patterns.
"""

from django.contrib import admin
from django.urls import path, include
from drf_spectacular.views import (
    SpectacularAPIView,
    SpectacularSwaggerView,
    SpectacularRedocView,
)

urlpatterns = [
    # Admin
    path("admin/", admin.site.urls),

    # API v1
    path("api/auth/",       include("apps.users.urls")),
    path("api/incomes/",    include("apps.incomes.urls")),
    path("api/expenses/",   include("apps.expenses.urls")),
    path("api/goals/",      include("apps.goals.urls")),
    path("api/investments/", include("apps.investments.urls")),
    path("api/dashboard/",  include("apps.dashboard.urls")),
    path("api/accounts/",   include("apps.accounts.urls")),
    path("api/planning/",   include("apps.planning.urls")),

    # OpenAPI / Swagger
    path("api/schema/",  SpectacularAPIView.as_view(), name="schema"),
    path("api/docs/",    SpectacularSwaggerView.as_view(url_name="schema"), name="swagger-ui"),
    path("api/redoc/",   SpectacularRedocView.as_view(url_name="schema"), name="redoc"),
]
