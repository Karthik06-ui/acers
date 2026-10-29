"""
notifications app — Notification model + service (Phase 5).

Triggers:
- BR9: request submitted → notify student + faculty
- BR9: approved / rejected / withdrawn → notify student
"""
from django.db import models
from django.conf import settings


class NotificationType(models.TextChoices):
    REQUEST_SUBMITTED = "REQUEST_SUBMITTED", "Enrollment Request Submitted"
    REQUEST_APPROVED = "REQUEST_APPROVED", "Enrollment Request Approved"
    REQUEST_REJECTED = "REQUEST_REJECTED", "Enrollment Request Rejected"
    ENROLLMENT_WITHDRAWN = "ENROLLMENT_WITHDRAWN", "Enrollment Withdrawn"
    GENERAL = "GENERAL", "General"


class Notification(models.Model):
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="notifications",
    )
    type = models.CharField(
        max_length=30, choices=NotificationType.choices, default=NotificationType.GENERAL
    )
    message = models.TextField()
    is_read = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at"]
        verbose_name = "Notification"
        verbose_name_plural = "Notifications"

    def __str__(self):
        return f"[{self.type}] → {self.user.email} ({'read' if self.is_read else 'unread'})"
