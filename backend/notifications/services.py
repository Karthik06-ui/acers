"""
Notification service — called from enrollment services (Phase 5).
Centralises notification creation so views stay thin.
"""
from .models import Notification, NotificationType


def notify(user, notification_type: str, message: str) -> Notification:
    """Create and return a Notification for *user*."""
    return Notification.objects.create(
        user=user,
        type=notification_type,
        message=message,
    )


def notify_many(users, notification_type: str, message: str):
    """Bulk-create notifications for a list/queryset of users."""
    Notification.objects.bulk_create([
        Notification(user=u, type=notification_type, message=message)
        for u in users
    ])
