"""
audit app — AuditLog model for sensitive HOD actions (BR10).

Written by: audit.services.log_action()
"""
from django.db import models
from django.conf import settings


class AuditLog(models.Model):
    """
    Immutable log of sensitive HOD actions.

    Fields:
    - actor:       The User who performed the action.
    - action:      A short verb string (e.g., 'APPROVE_FACULTY').
    - target_type: Django content-type label, e.g. 'accounts.Faculty'.
    - target_id:   PK of the affected object (nullable for bulk/system ops).
    - details:     JSON dict with before/after or other context.
    - created_at:  Timestamp (auto).
    """
    actor = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        null=True,
        on_delete=models.SET_NULL,
        related_name="audit_logs",
    )
    action = models.CharField(max_length=60, db_index=True)
    target_type = models.CharField(max_length=100, blank=True)
    target_id = models.PositiveBigIntegerField(null=True, blank=True)
    details = models.JSONField(default=dict, blank=True)
    created_at = models.DateTimeField(auto_now_add=True, db_index=True)

    class Meta:
        ordering = ["-created_at"]
        verbose_name = "Audit Log"
        verbose_name_plural = "Audit Logs"

    def __str__(self):
        actor = self.actor.email if self.actor else "SYSTEM"
        return f"[{self.created_at:%Y-%m-%d %H:%M}] {actor} → {self.action} ({self.target_type}:{self.target_id})"
