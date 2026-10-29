"""
accounts/models.py
Custom User model (email login) + Student, Faculty, HOD profile models.
"""
from decimal import Decimal
from django.contrib.auth.models import AbstractBaseUser, BaseUserManager, PermissionsMixin
from django.core.validators import MinValueValidator, MaxValueValidator
from django.db import models


# ── Choices ───────────────────────────────────────────────────────────────────

class UserRole(models.TextChoices):
    STUDENT = "STUDENT", "Student"
    FACULTY = "FACULTY", "Faculty"
    HOD     = "HOD",     "HOD"


class UserStatus(models.TextChoices):
    ACTIVE    = "ACTIVE",    "Active"
    INACTIVE  = "INACTIVE",  "Inactive"
    SUSPENDED = "SUSPENDED", "Suspended"


class ApprovalStatus(models.TextChoices):
    PENDING  = "Pending",  "Pending"
    APPROVED = "Approved", "Approved"
    REJECTED = "Rejected", "Rejected"


class AccountStatus(models.TextChoices):
    PENDING  = "Pending",  "Pending"
    ACTIVE   = "Active",   "Active"
    INACTIVE = "Inactive", "Inactive"


# ── User Manager ──────────────────────────────────────────────────────────────

class UserManager(BaseUserManager):
    def _create_user(self, email, password, **extra_fields):
        if not email:
            raise ValueError("Email address is required.")
        email = self.normalize_email(email)
        user  = self.model(email=email, **extra_fields)
        user.set_password(password)
        user.save(using=self._db)
        return user

    def create_user(self, email, password=None, **extra_fields):
        extra_fields.setdefault("is_staff",     False)
        extra_fields.setdefault("is_superuser", False)
        return self._create_user(email, password, **extra_fields)

    def create_superuser(self, email, password=None, **extra_fields):
        extra_fields.setdefault("is_staff",     True)
        extra_fields.setdefault("is_superuser", True)
        extra_fields.setdefault("role",   UserRole.HOD)
        extra_fields.setdefault("status", UserStatus.ACTIVE)
        if not extra_fields.get("is_staff"):
            raise ValueError("Superuser must have is_staff=True.")
        if not extra_fields.get("is_superuser"):
            raise ValueError("Superuser must have is_superuser=True.")
        return self._create_user(email, password, **extra_fields)


# ── User ──────────────────────────────────────────────────────────────────────

class User(AbstractBaseUser, PermissionsMixin):
    """
    Central auth table.  Email is the unique identifier.
    All profile details live in Student / Faculty / HOD (1-to-1 relations).
    """
    email  = models.EmailField(unique=True, db_index=True)
    role   = models.CharField(max_length=10, choices=UserRole.choices,   db_index=True)
    status = models.CharField(max_length=10, choices=UserStatus.choices,
                              default=UserStatus.ACTIVE)

    # Django internals
    is_staff  = models.BooleanField(default=False)
    is_active = models.BooleanField(default=True)

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    objects = UserManager()

    USERNAME_FIELD  = "email"
    REQUIRED_FIELDS = ["role"]

    class Meta:
        verbose_name        = "User"
        verbose_name_plural = "Users"
        ordering            = ["-created_at"]

    def __str__(self):
        return f"{self.email} ({self.role})"

    # Convenience helpers
    @property
    def is_student(self):  return self.role == UserRole.STUDENT
    @property
    def is_faculty(self):  return self.role == UserRole.FACULTY
    @property
    def is_hod(self):      return self.role == UserRole.HOD


# ── Student Profile ───────────────────────────────────────────────────────────

class Student(models.Model):
    class YearChoice(models.IntegerChoices):
        FIRST  = 1, "1st Year"
        SECOND = 2, "2nd Year"
        THIRD  = 3, "3rd Year"
        FOURTH = 4, "4th Year"

    class StudentStatus(models.TextChoices):
        ACTIVE    = "Active",    "Active"
        INACTIVE  = "Inactive",  "Inactive"
        GRADUATED = "Graduated", "Graduated"
        SUSPENDED = "Suspended", "Suspended"

    user       = models.OneToOneField(User, on_delete=models.CASCADE,
                                      related_name="student_profile")
    department = models.ForeignKey("academics.Department", on_delete=models.PROTECT,
                                   related_name="students", null=True, blank=True)
    name    = models.CharField(max_length=150)
    roll_no = models.CharField(max_length=30, unique=True, db_index=True)
    year    = models.IntegerField(choices=YearChoice.choices, default=YearChoice.FIRST)
    phone   = models.CharField(max_length=15, blank=True)
    cgpa    = models.DecimalField(max_digits=4, decimal_places=2,
                                  default=Decimal('0.00'),
                                  validators=[MinValueValidator(Decimal('0')), MaxValueValidator(Decimal('10'))])
    status  = models.CharField(max_length=10, choices=StudentStatus.choices,
                               default=StudentStatus.ACTIVE)

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name        = "Student"
        verbose_name_plural = "Students"
        ordering            = ["roll_no"]
        indexes             = [models.Index(fields=["department", "year"])]

    def __str__(self):
        return f"{self.name} ({self.roll_no})"


# ── Faculty Profile ───────────────────────────────────────────────────────────

class Faculty(models.Model):
    class Designation(models.TextChoices):
        ASSISTANT_PROFESSOR = "Assistant Professor", "Assistant Professor"
        ASSOCIATE_PROFESSOR = "Associate Professor", "Associate Professor"
        PROFESSOR           = "Professor",           "Professor"
        LECTURER            = "Lecturer",            "Lecturer"
        VISITING            = "Visiting Faculty",    "Visiting Faculty"

    user            = models.OneToOneField(User, on_delete=models.CASCADE,
                                           related_name="faculty_profile")
    department      = models.ForeignKey("academics.Department", on_delete=models.PROTECT,
                                        related_name="faculty_members", null=True, blank=True)
    name            = models.CharField(max_length=150)
    phone           = models.CharField(max_length=15, blank=True)
    designation     = models.CharField(max_length=30, choices=Designation.choices,
                                       default=Designation.ASSISTANT_PROFESSOR)
    approval_status = models.CharField(max_length=10, choices=ApprovalStatus.choices,
                                       default=ApprovalStatus.PENDING, db_index=True)
    account_status  = models.CharField(max_length=10, choices=AccountStatus.choices,
                                       default=AccountStatus.PENDING, db_index=True)

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name        = "Faculty"
        verbose_name_plural = "Faculty Members"
        ordering            = ["name"]
        indexes             = [models.Index(fields=["department", "approval_status"])]

    def __str__(self):
        return f"{self.name} ({self.designation})"

    @property
    def is_approved_and_active(self):
        return (self.approval_status == ApprovalStatus.APPROVED
                and self.account_status == AccountStatus.ACTIVE)


# ── HOD Profile ───────────────────────────────────────────────────────────────

class HOD(models.Model):
    class HODStatus(models.TextChoices):
        ACTIVE   = "Active",   "Active"
        INACTIVE = "Inactive", "Inactive"

    user       = models.OneToOneField(User, on_delete=models.CASCADE,
                                      related_name="hod_profile")
    department = models.ForeignKey("academics.Department", on_delete=models.PROTECT,
                                   related_name="hods", null=True, blank=True)
    name   = models.CharField(max_length=150)
    phone  = models.CharField(max_length=15, blank=True)
    status = models.CharField(max_length=10, choices=HODStatus.choices,
                              default=HODStatus.ACTIVE)

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name        = "HOD"
        verbose_name_plural = "HODs"
        ordering            = ["name"]

    def __str__(self):
        return f"{self.name} — HOD"
