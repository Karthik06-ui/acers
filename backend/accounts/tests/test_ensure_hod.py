"""
accounts/tests/test_ensure_hod.py
Tests for ensure_hod management command.
"""
import io
import os
from unittest import mock
from django.core.management import call_command
from django.test import TestCase
from accounts.models import User, HOD, UserRole, UserStatus
from academics.models import Department, DepartmentStatus


class EnsureHODCommandTests(TestCase):
    def test_skips_when_env_vars_missing(self):
        out = io.StringIO()
        with mock.patch.dict(os.environ, {}, clear=True):
            call_command("ensure_hod", stdout=out)
        self.assertIn("skipping", out.getvalue())
        self.assertEqual(User.objects.count(), 0)

    def test_skips_when_password_missing(self):
        out = io.StringIO()
        with mock.patch.dict(os.environ, {"HOD_EMAIL": "hod@test.com"}, clear=True):
            call_command("ensure_hod", stdout=out)
        self.assertIn("skipping", out.getvalue())
        self.assertEqual(User.objects.count(), 0)

    def test_creates_hod_user_and_profile(self):
        out = io.StringIO()
        env = {
            "HOD_EMAIL": "hod@test.com",
            "HOD_PASSWORD": "TestPassword@123",
            "HOD_NAME": "Dr. Smith",
            "HOD_DEPT_CODE": "CSE",
            "HOD_DEPT_NAME": "Computer Science and Engineering",
        }
        with mock.patch.dict(os.environ, env, clear=True):
            call_command("ensure_hod", stdout=out)

        self.assertIn("HOD created", out.getvalue())

        user = User.objects.get(email="hod@test.com")
        self.assertEqual(user.role, UserRole.HOD)
        self.assertEqual(user.status, UserStatus.ACTIVE)
        self.assertTrue(user.is_staff)
        self.assertTrue(user.is_superuser)
        self.assertTrue(user.check_password("TestPassword@123"))

        dept = Department.objects.get(code="CSE")
        self.assertEqual(dept.name, "Computer Science and Engineering")
        self.assertEqual(dept.status, DepartmentStatus.ACTIVE)

        hod = HOD.objects.get(user=user)
        self.assertEqual(hod.name, "Dr. Smith")
        self.assertEqual(hod.department, dept)
        self.assertEqual(hod.status, HOD.HODStatus.ACTIVE)

    def test_skips_when_hod_already_exists(self):
        # Create HOD first
        env = {
            "HOD_EMAIL": "hod@test.com",
            "HOD_PASSWORD": "TestPassword@123",
            "HOD_NAME": "Dr. Smith",
            "HOD_DEPT_CODE": "CSE",
        }
        with mock.patch.dict(os.environ, env, clear=True):
            call_command("ensure_hod")

        # Second run should report already exists
        out = io.StringIO()
        with mock.patch.dict(os.environ, env, clear=True):
            call_command("ensure_hod", stdout=out)

        self.assertIn("HOD already exists, skipping", out.getvalue())
        self.assertEqual(User.objects.filter(email="hod@test.com").count(), 1)

