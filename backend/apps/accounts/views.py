from django.db.models import ProtectedError
from rest_framework import status, viewsets
from rest_framework.decorators import action
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from . import services
from .currency import Currency
from .models import Account, AccountKind, Transfer
from .serializers import AccountSerializer, TransferSerializer


class AccountViewSet(viewsets.ModelViewSet):
    """
    CRUD for the user's accounts (unpaginated: a user has a handful).
        GET /api/accounts/balances/  → every account with its current balance
                                       + total in lempiras
        GET /api/accounts/options/   → kinds and currencies for dropdowns
    """

    serializer_class = AccountSerializer
    permission_classes = [IsAuthenticated]
    pagination_class = None
    filterset_fields = ["is_archived", "currency"]

    def get_queryset(self):
        return Account.objects.filter(user=self.request.user)

    def perform_create(self, serializer):
        serializer.save(user=self.request.user)

    def destroy(self, request, *args, **kwargs):
        try:
            return super().destroy(request, *args, **kwargs)
        except ProtectedError:
            return Response(
                {"detail": "Esta cuenta tiene movimientos registrados. Archívala en lugar de eliminarla."},
                status=status.HTTP_400_BAD_REQUEST,
            )

    @action(detail=False, methods=["get"])
    def balances(self, request):
        return Response(services.net_worth(request.user))

    @action(detail=False, methods=["get"])
    def options(self, request):
        return Response({
            "kinds": [{"value": v, "label": l} for v, l in AccountKind.choices],
            "currencies": [{"value": v, "label": l} for v, l in Currency.choices],
        })


class TransferViewSet(viewsets.ModelViewSet):
    """CRUD for transfers / currency conversions between accounts."""

    serializer_class = TransferSerializer
    permission_classes = [IsAuthenticated]
    ordering = ["-date", "-created_at"]

    def get_queryset(self):
        return (
            Transfer.objects.filter(user=self.request.user)
            .select_related("from_account", "to_account")
        )

    def perform_create(self, serializer):
        serializer.save(user=self.request.user)
