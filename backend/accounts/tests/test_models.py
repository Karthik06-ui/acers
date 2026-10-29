"""
Phase 1 tests for the accounts app.

Tests:
- Custom User model (create_user, create_superuser)
- UserManager validation
- Role / status choices
- Health endpoint (smoke test)
"""
from django.test import TestCase
from django.urls import reverse
from rest_framework.test import APIClient
from accounts.models import User, UserRole, UserStatus


class UserManagerTests(TestCase):
    """Test the custom UserManager."""

    def test_create_user_requires_email(self):
        with self.assertRaises(ValueError):
            User.objects.create_user(email="", password="secret123")

    def test_create_user_sets_fields(self):
        user = User.objects.create_user(
            email="student@example.com",
            password="secret123",
            role=UserRole.STUDENT,
        )
        self.assertEqual(user.email, "student@example.com")
        self.assertEqual(user.role, UserRole.STUDENT)
        self.assertFalse(user.is_staff)
        self.assertFalse(user.is_superuser)
        self.assertTrue(user.check_password("secret123"))

    def test_create_superuser_sets_flags(self):
        admin = User.objects.create_superuser(
            email="hod@example.com",
            password="admin123",
        )
        self.assertTrue(admin.is_staff)
        self.assertTrue(admin.is_superuser)
        self.assertEqual(admin.role, UserRole.HOD)

    def test_email_normalised(self):
        user = User.objects.create_user(
            email="Test@EXAMPLE.COM",
            password="pass",
            role=UserRole.STUDENT,
        )
        self.assertEqual(user.email, "Test@example.com")

    def test_email_is_unique(self):
        User.objects.create_user(email="a@b.com", password="pass", role=UserRole.STUDENT)
        with self.assertRaises(Exception):
            User.objects.create_user(email="a@b.com", password="pass2", role=UserRole.FACULTY)


class UserModelTests(TestCase):
    """Test User model properties and __str__."""

    def setUp(self):
        self.student = User.objects.create_user(
            email="s@uni.edu", password="pass", role=UserRole.STUDENT
        )
        self.faculty = User.objects.create_user(
            email="f@uni.edu", password="pass", role=UserRole.FACULTY
        )
        self.hod = User.objects.create_user(
            email="h@uni.edu", password="pass", role=UserRole.HOD
        )

    def test_is_student_property(self):
        self.assertTrue(self.student.is_student)
        self.assertFalse(self.student.is_faculty)
        self.assertFalse(self.student.is_hod)

    def test_is_faculty_property(self):
        self.assertTrue(self.faculty.is_faculty)

    def test_is_hod_property(self):
        self.assertTrue(self.hod.is_hod)

    def test_str(self):
        self.assertIn("s@uni.edu", str(self.student))
        self.assertIn("STUDENT", str(self.student))

    def test_default_status_active(self):
        self.assertEqual(self.student.status, UserStatus.ACTIVE)


class HealthCheckTests(TestCase):
    """Smoke-test the /api/health/ endpoint (no auth required)."""

    def setUp(self):
        self.client = APIClient()

    def test_health_returns_200(self):
        response = self.client.get("/api/health/")
        self.assertEqual(response.status_code, 200)

    def test_health_returns_ok(self):
        response = self.client.get("/api/health/")
        self.assertEqual(response.json(), {"status": "ok"})
