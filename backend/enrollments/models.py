"""
enrollments/models.py
EnrollmentRequest, Enrollment, AcademicRecord
"""
from decimal import Decimal
from django.core.validators import MinValueValidator, MaxValueValidator
from django.db import models
from django.utils import timezone


# ── EnrollmentRequest ─────────────────────────────────────────────────────────

class RequestStatus(models.TextChoices):
    PENDING   = "Pending",   "Pending"
    APPROVED  = "Approved",  "Approved"
    REJECTED  = "Rejected",  "Rejected"
    CANCELLED = "Cancelled", "Cancelled"


class EnrollmentRequest(models.Model):
    student      = models.ForeignKey("accounts.Student",
                                     on_delete=models.CASCADE,
                                     related_name="enrollment_requests")
    offering     = models.ForeignKey("academics.CourseOffering",
                                     on_delete=models.PROTECT,
                                     related_name="enrollment_requests")
    request_date = models.DateTimeField(default=timezone.now)
    status       = models.CharField(max_length=10, choices=RequestStatus.choices,
                                    default=RequestStatus.PENDING, db_index=True)
    reviewed_by  = models.ForeignKey("accounts.User",
                                     on_delete=models.SET_NULL,
                                     null=True, blank=True,
                                     related_name="reviewed_requests",
                                     help_text="Faculty or HOD who reviewed this request.")
    reviewed_date = models.DateTimeField(null=True, blank=True)
    remarks       = models.TextField(blank=True)

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name        = "Enrollment Request"
        verbose_name_plural = "Enrollment Requests"
        ordering            = ["-request_date"]
        indexes = [
            models.Index(fields=["student", "status"]),
            models.Index(fields=["offering", "status"]),
        ]
        constraints = [
            # At most one Pending request per student-offering pair.
            models.UniqueConstraint(
                fields=["student", "offering"],
                condition=models.Q(status="Pending"),
                name="unique_pending_request_per_student_offering",
            ),
        ]

    def __str__(self):
        return (f"Request #{self.pk}: {self.student} → "
                f"{self.offering.course.code} [{self.status}]")


# ── Enrollment ────────────────────────────────────────────────────────────────

class EnrollmentStatus(models.TextChoices):
    ACTIVE    = "Active",    "Active"
    WITHDRAWN = "Withdrawn", "Withdrawn"
    COMPLETED = "Completed", "Completed"


class Enrollment(models.Model):
    student         = models.ForeignKey("accounts.Student",
                                        on_delete=models.CASCADE,
                                        related_name="enrollments")
    offering        = models.ForeignKey("academics.CourseOffering",
                                        on_delete=models.PROTECT,
                                        related_name="enrollments")
    request         = models.OneToOneField(EnrollmentRequest,
                                           on_delete=models.PROTECT,
                                           related_name="enrollment")
    enrollment_date = models.DateTimeField(default=timezone.now)
    approved_date   = models.DateTimeField(null=True, blank=True)
    withdrawal_date = models.DateTimeField(null=True, blank=True)
    status          = models.CharField(max_length=10, choices=EnrollmentStatus.choices,
                                       default=EnrollmentStatus.ACTIVE, db_index=True)
    grade_points    = models.DecimalField(max_digits=4, decimal_places=2,
                                          null=True, blank=True,
                                          validators=[MinValueValidator(Decimal('0')),
                                                      MaxValueValidator(Decimal('10'))])
    remarks         = models.TextField(blank=True)

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name        = "Enrollment"
        verbose_name_plural = "Enrollments"
        ordering            = ["-enrollment_date"]
        indexes = [
            models.Index(fields=["student", "status"]),
            models.Index(fields=["offering", "status"]),
        ]
        constraints = [
            # Only one Active enrollment per student-offering.
            models.UniqueConstraint(
                fields=["student", "offering"],
                condition=models.Q(status="Active"),
                name="unique_active_enrollment_per_student_offering",
            ),
            # grade_points must be between 0 and 10 (inclusive) when set.
            models.CheckConstraint(
                check=(
                    models.Q(grade_points__isnull=True)
                    | (models.Q(grade_points__gte=0) & models.Q(grade_points__lte=10))
                ),
                name="enrollment_grade_points_range",
            ),
        ]

    def __str__(self):
        return (f"Enrollment #{self.pk}: {self.student} → "
                f"{self.offering.course.code} [{self.status}]")


# ── AcademicRecord ────────────────────────────────────────────────────────────

class AcademicRecord(models.Model):
    """Per-student, per-semester academic summary. Recomputed on each completion."""
    student          = models.ForeignKey("accounts.Student",
                                         on_delete=models.CASCADE,
                                         related_name="academic_records")
    semester         = models.ForeignKey("academics.Semester",
                                         on_delete=models.PROTECT,
                                         related_name="academic_records")
    semester_gpa     = models.DecimalField(max_digits=4, decimal_places=2, default=0.00,
                                           validators=[MinValueValidator(Decimal('0')),
                                                       MaxValueValidator(Decimal('10'))])
    credits_registered = models.PositiveSmallIntegerField(default=0)
    credits_earned     = models.PositiveSmallIntegerField(default=0)
    cumulative_cgpa    = models.DecimalField(max_digits=4, decimal_places=2, default=0.00,
                                             validators=[MinValueValidator(Decimal('0')),
                                                         MaxValueValidator(Decimal('10'))])

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name        = "Academic Record"
        verbose_name_plural = "Academic Records"
        ordering            = ["student", "-semester__academic_year"]
        unique_together     = [("student", "semester")]   # one record per student per semester
        indexes             = [models.Index(fields=["student", "semester"])]

    def __str__(self):
        return (f"{self.student} | {self.semester} "
                f"| SGPA {self.semester_gpa} | CGPA {self.cumulative_cgpa}")
