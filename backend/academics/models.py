"""
academics/models.py
Department, Semester, Course, CourseOffering
"""
from decimal import Decimal
from django.core.validators import MinValueValidator, MaxValueValidator
from django.db import models


# ── Department ────────────────────────────────────────────────────────────────

class DepartmentStatus(models.TextChoices):
    ACTIVE   = "Active",   "Active"
    INACTIVE = "Inactive", "Inactive"


class Department(models.Model):
    name   = models.CharField(max_length=120, unique=True)
    code   = models.CharField(max_length=10,  unique=True, db_index=True)
    status = models.CharField(max_length=10,  choices=DepartmentStatus.choices,
                              default=DepartmentStatus.ACTIVE)

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name        = "Department"
        verbose_name_plural = "Departments"
        ordering            = ["name"]

    def __str__(self):
        return f"{self.code} — {self.name}"


# ── Semester ──────────────────────────────────────────────────────────────────

class SemesterStatus(models.TextChoices):
    UPCOMING = "Upcoming", "Upcoming"
    OPEN     = "Open",     "Open"
    CLOSED   = "Closed",   "Closed"


class SemesterName(models.TextChoices):
    ODD  = "Odd",  "Odd"
    EVEN = "Even", "Even"


class Semester(models.Model):
    academic_year = models.CharField(max_length=9, help_text="e.g. 2024-2025")
    semester_name = models.CharField(max_length=10, choices=SemesterName.choices)
    start_date    = models.DateField()
    end_date      = models.DateField()
    status        = models.CharField(max_length=10, choices=SemesterStatus.choices,
                                     default=SemesterStatus.UPCOMING, db_index=True)

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name        = "Semester"
        verbose_name_plural = "Semesters"
        ordering            = ["-academic_year", "semester_name"]
        unique_together     = [("academic_year", "semester_name")]

    def __str__(self):
        return f"{self.academic_year} {self.semester_name} ({self.status})"


# ── Course ────────────────────────────────────────────────────────────────────

class CourseType(models.TextChoices):
    THEORY     = "Theory",     "Theory"
    LAB        = "Lab",        "Lab"
    THEORY_LAB = "Theory+Lab", "Theory+Lab"


class CourseStatus(models.TextChoices):
    DRAFT    = "Draft",    "Draft"
    OPEN     = "Open",     "Open"
    CLOSED   = "Closed",   "Closed"
    ARCHIVED = "Archived", "Archived"


class Course(models.Model):
    code        = models.CharField(max_length=20, unique=True, db_index=True)
    name        = models.CharField(max_length=200)
    credits     = models.PositiveSmallIntegerField(
                      validators=[MinValueValidator(1), MaxValueValidator(6)])
    course_type = models.CharField(max_length=12, choices=CourseType.choices,
                                   default=CourseType.THEORY)
    capacity    = models.PositiveIntegerField(
                      validators=[MinValueValidator(1)],
                      help_text="Maximum seats per offering (default for new offerings).")
    minimum_cgpa = models.DecimalField(max_digits=4, decimal_places=2,
                                       null=True, blank=True,
                                       validators=[MinValueValidator(Decimal('0')), MaxValueValidator(Decimal('10'))],
                                       help_text="Minimum CGPA required to enroll. Blank = no requirement.")
    description = models.TextField(blank=True)
    department  = models.ForeignKey(Department, on_delete=models.PROTECT,
                                    related_name="courses")
    status      = models.CharField(max_length=10, choices=CourseStatus.choices,
                                   default=CourseStatus.DRAFT, db_index=True)

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name        = "Course"
        verbose_name_plural = "Courses"
        ordering            = ["code"]
        indexes             = [
            models.Index(fields=["department", "status"]),
            models.Index(fields=["course_type"]),
        ]

    def __str__(self):
        return f"{self.code} — {self.name}"


# ── CourseOffering ────────────────────────────────────────────────────────────

class OfferingStatus(models.TextChoices):
    OPEN   = "Open",   "Open"
    CLOSED = "Closed", "Closed"


class CourseOffering(models.Model):
    course   = models.ForeignKey(Course,   on_delete=models.PROTECT,
                                 related_name="offerings")
    faculty  = models.ForeignKey("accounts.Faculty", on_delete=models.PROTECT,
                                 related_name="offerings")
    semester = models.ForeignKey(Semester, on_delete=models.PROTECT,
                                 related_name="offerings")
    # Capacity defaults to course.capacity but can be overridden per-offering.
    capacity = models.PositiveIntegerField(validators=[MinValueValidator(1)])
    status   = models.CharField(max_length=10, choices=OfferingStatus.choices,
                                default=OfferingStatus.OPEN, db_index=True)

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name        = "Course Offering"
        verbose_name_plural = "Course Offerings"
        ordering            = ["-semester__academic_year", "course__code"]
        # A course can only be offered once per faculty per semester.
        unique_together = [("course", "faculty", "semester")]
        indexes         = [
            models.Index(fields=["semester", "status"]),
            models.Index(fields=["faculty", "semester"]),
        ]

    def __str__(self):
        return f"{self.course.code} / {self.faculty.name} / {self.semester}"

    def save(self, *args, **kwargs):
        # On first create, inherit course capacity if not explicitly set.
        if not self.pk and not self.capacity:
            self.capacity = self.course.capacity
        super().save(*args, **kwargs)

    @property
    def active_enrollment_count(self):
        return self.enrollments.filter(status="Active").count()

    @property
    def seats_available(self):
        return max(0, self.capacity - self.active_enrollment_count)
