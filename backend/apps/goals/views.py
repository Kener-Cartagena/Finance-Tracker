from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated

from .models import Goal
from .serializers import GoalSerializer, GoalContributionSerializer
from .services import GoalContributionService


class GoalViewSet(viewsets.ModelViewSet):
    serializer_class   = GoalSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        return Goal.objects.filter(user=self.request.user)

    def perform_create(self, serializer):
        serializer.save(user=self.request.user)

    @action(detail=True, methods=['post'], url_path='contribute')
    def contribute(self, request, pk=None):
        goal = self.get_object()

        serializer = GoalContributionSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        contribution, updated_goal = GoalContributionService.contribute(
            goal=goal,
            amount=serializer.validated_data['amount'],
            date=serializer.validated_data['date'],
            note=serializer.validated_data.get('note', ''),
        )

        return Response({
            'goal':         GoalSerializer(updated_goal).data,
            'contribution': GoalContributionSerializer(contribution).data,
        }, status=status.HTTP_200_OK)

    @action(detail=True, methods=['get'], url_path='contributions')
    def contributions(self, request, pk=None):
        goal = self.get_object()
        qs   = goal.contributions.all()
        serializer = GoalContributionSerializer(qs, many=True)
        return Response(serializer.data)
