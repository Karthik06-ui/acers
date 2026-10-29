"""
Audit service — call log_action() from HOD service functions.

Usage:
    from audit.services import log_action
    log_action(actor=request.user, action="APPROVE_FACULTY",
               target_type="accounts.Faculty", target_id=faculty.pk,
               details={"before": "Pending", "after": "Approved"})
"""
from .models import AuditLog


def log_action(actor, action: str, target_type: str = "", target_id=None, details: dict = None):
    """Create an immutable AuditLog entry."""
    return AuditLog.objects.create(
        actor=actor,
        action=action,
        target_type=target_type,
        target_id=target_id,
        details=details or {},
    )
