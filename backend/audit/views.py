"""
audit/views.py
HOD Audit Log view.
"""
from rest_framework import generics
from accounts.permissions import IsHOD
from .models import AuditLog
from .serializers import AuditLogSerializer


class AuditLogListView(generics.ListAPIView):
    permission_classes = [IsHOD]
    serializer_class = AuditLogSerializer

    def get_queryset(self):
        qs = AuditLog.objects.select_related("actor").order_by("-created_at")
        action = self.request.query_params.get("action")
        if action:
            qs = qs.filter(action=action)
        actor_id = self.request.query_params.get("actor")
        if actor_id:
            qs = qs.filter(actor_id=actor_id)
        actor_email = self.request.query_params.get("actor_email")
        if actor_email:
            qs = qs.filter(actor__email__icontains=actor_email)
        target_type = self.request.query_params.get("target_type")
        if target_type:
            qs = qs.filter(target_type__icontains=target_type)
        return qs
