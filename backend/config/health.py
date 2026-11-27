"""
GET /api/health/

Endpoint público y ligero para healthchecks (Docker, balanceadores, CI).
Responde 200 si la app arranca y la base de datos acepta conexiones; 503 si no.
"""

from django.db import connection
from django.http import JsonResponse


def health(request):
    try:
        connection.ensure_connection()
    except Exception:
        return JsonResponse({"status": "error", "database": "unavailable"}, status=503)
    return JsonResponse({"status": "ok"})
