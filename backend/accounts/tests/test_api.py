"""
accounts/tests/test_api.py

Covers the Phase 3 auth + permissions checkpoint:
- duplicate email (student + faculty)
- wrong password blocked
- pending faculty can login but gets pending_approval=True
- rejected faculty blocked
- inactive/suspended account blocked
- student blocked from HOD endpoints
- token refresh works
- logout blacklists token (refresh fails after)
- faculty lifecycle: Pending -> Approved -> Active, Pending -> Rejected
- new faculty cannot manage courses until approved
"""
from django.urls import reverse
from rest_framework import status
from rest_framework.test import APITestCase

from accounts.models import (
    User, Student, Faculty, HOD,
    UserRole, UserStatus, ApprovalStatus, AccountStatus,
)
from academics.models import Department, Semester, Course, SemesterName, SemesterStatus


# ── helpers ───────────────────────────────────────────────────────────────────

def make_hod(email="hod@test.com", password="Pass@1234"):
    dept, _ = Department.objects.get_or_create(code="TST", defaults={"name": "Test Dept"})
    u = User.objects.create_user(email=email, password=password,
                                  role=UserRole.HOD, status=UserStatus.ACTIVE)
    HOD.objects.create(user=u, name="Test HOD", department=dept, status="Active")
    return u, dept


def make_student(email="stu@test.com", password="Pass@1234", roll="T001"):
    dept, _ = Department.objects.get_or_create(code="TST", defaults={"name": "Test Dept"})
    u = User.objects.create_user(email=email, password=password,
                                  role=UserRole.STUDENT, status=UserStatus.ACTIVE)
    Student.objects.create(user=u, name="Test Student", roll_no=roll, department=dept)
    return u


def make_faculty(email="fac@test.com", password="Pass@1234",
                 approval=ApprovalStatus.APPROVED, acct=AccountStatus.ACTIVE):
    dept, _ = Department.objects.get_or_create(code="TST", defaults={"name": "Test Dept"})
    u = User.objects.create_user(email=email, password=password,
                                  role=UserRole.FACULTY, status=UserStatus.ACTIVE)
    Faculty.objects.create(user=u, name="Test Faculty", department=dept,
                            approval_status=approval, account_status=acct)
    return u


def login(client, email, password="Pass@1234"):
    resp = client.post(reverse("accounts:login"),
                       {"email": email, "password": password}, format="json")
    return resp


def auth_header(token):
    return {"HTTP_AUTHORIZATION": f"Bearer {token}"}


# ── Registration ──────────────────────────────────────────────────────────────

class StudentRegisterTests(APITestCase):
    def test_register_student_success(self):
        resp = self.client.post(reverse("accounts:register-student"), {
            "email": "new@test.com", "password": "Pass@1234",
            "name": "New Student", "roll_no": "R001",
        }, format="json")
        self.assertEqual(resp.status_code, 201)
        self.assertTrue(User.objects.filter(email="new@test.com").exists())

    def test_duplicate_email(self):
        make_student()
        resp = self.client.post(reverse("accounts:register-student"), {
            "email": "stu@test.com", "password": "Pass@1234",
            "name": "Dup", "roll_no": "R999",
        }, format="json")
        self.assertEqual(resp.status_code, 400)

    def test_duplicate_roll_no(self):
        make_student()
        resp = self.client.post(reverse("accounts:register-student"), {
            "email": "another@test.com", "password": "Pass@1234",
            "name": "Dup", "roll_no": "T001",
        }, format="json")
        self.assertEqual(resp.status_code, 400)


class FacultyRegisterTests(APITestCase):
    def test_register_faculty_creates_pending(self):
        resp = self.client.post(reverse("accounts:register-faculty"), {
            "email": "fac2@test.com", "password": "Pass@1234", "name": "New Fac",
        }, format="json")
        self.assertEqual(resp.status_code, 201)
        fac = Faculty.objects.get(user__email="fac2@test.com")
        self.assertEqual(fac.approval_status, ApprovalStatus.PENDING)
        self.assertEqual(fac.account_status, AccountStatus.PENDING)

    def test_duplicate_email_faculty(self):
        make_faculty()
        resp = self.client.post(reverse("accounts:register-faculty"), {
            "email": "fac@test.com", "password": "Pass@1234", "name": "Dup",
        }, format="json")
        self.assertEqual(resp.status_code, 400)


# ── Login ─────────────────────────────────────────────────────────────────────

class LoginTests(APITestCase):
    def test_login_success_student(self):
        make_student()
        resp = login(self.client, "stu@test.com")
        self.assertEqual(resp.status_code, 200)
        self.assertIn("access", resp.data)
        self.assertIn("refresh", resp.data)
        self.assertEqual(resp.data["role"], UserRole.STUDENT)

    def test_wrong_password_blocked(self):
        make_student()
        resp = login(self.client, "stu@test.com", password="WrongPass!")
        self.assertEqual(resp.status_code, 401)

    def test_pending_faculty_can_login_gets_flag(self):
        make_faculty(approval=ApprovalStatus.PENDING, acct=AccountStatus.PENDING)
        resp = login(self.client, "fac@test.com")
        self.assertEqual(resp.status_code, 200)
        self.assertTrue(resp.data.get("pending_approval"))

    def test_rejected_faculty_blocked(self):
        make_faculty(approval=ApprovalStatus.REJECTED, acct=AccountStatus.INACTIVE)
        resp = login(self.client, "fac@test.com")
        self.assertEqual(resp.status_code, 400)

    def test_inactive_account_blocked(self):
        u = make_student(email="inactive@test.com", roll="I001")
        u.status = UserStatus.INACTIVE
        u.save()
        resp = login(self.client, "inactive@test.com")
        self.assertEqual(resp.status_code, 400)

    def test_suspended_account_blocked(self):
        u = make_student(email="sus@test.com", roll="S001")
        u.status = UserStatus.SUSPENDED
        u.save()
        resp = login(self.client, "sus@test.com")
        self.assertEqual(resp.status_code, 400)


# ── Token refresh + logout ────────────────────────────────────────────────────

class TokenTests(APITestCase):
    def setUp(self):
        make_student()
        resp = login(self.client, "stu@test.com")
        self.access  = resp.data["access"]
        self.refresh = resp.data["refresh"]

    def test_refresh_works(self):
        resp = self.client.post(reverse("accounts:token-refresh"),
                                {"refresh": self.refresh}, format="json")
        self.assertEqual(resp.status_code, 200)
        self.assertIn("access", resp.data)

    def test_logout_blacklists_token(self):
        self.client.post(reverse("accounts:logout"),
                         {"refresh": self.refresh}, format="json",
                         **auth_header(self.access))
        # Refresh should now fail
        resp = self.client.post(reverse("accounts:token-refresh"),
                                {"refresh": self.refresh}, format="json")
        self.assertEqual(resp.status_code, 401)


# ── Permission enforcement ────────────────────────────────────────────────────

class PermissionTests(APITestCase):
    def setUp(self):
        self.hod_user, self.dept = make_hod()
        self.stu_user = make_student()
        self.fac_pending = make_faculty(
            email="pending@test.com",
            approval=ApprovalStatus.PENDING, acct=AccountStatus.PENDING
        )
        hod_resp = login(self.client, "hod@test.com")
        stu_resp  = login(self.client, "stu@test.com")
        pend_resp = login(self.client, "pending@test.com")
        self.hod_token  = hod_resp.data["access"]
        self.stu_token  = stu_resp.data["access"]
        self.pend_token = pend_resp.data["access"]

    def test_student_blocked_from_hod_faculty_list(self):
        resp = self.client.get(
            reverse("accounts:hod-faculty-list"),
            **auth_header(self.stu_token)
        )
        self.assertEqual(resp.status_code, 403)

    def test_hod_can_list_faculty(self):
        resp = self.client.get(
            reverse("accounts:hod-faculty-list"),
            **auth_header(self.hod_token)
        )
        self.assertEqual(resp.status_code, 200)

    def test_student_blocked_from_hod_student_list(self):
        resp = self.client.get(
            reverse("accounts:hod-student-list"),
            **auth_header(self.stu_token)
        )
        self.assertEqual(resp.status_code, 403)

    def test_pending_faculty_blocked_from_hod_endpoints(self):
        resp = self.client.get(
            reverse("accounts:hod-faculty-list"),
            **auth_header(self.pend_token)
        )
        self.assertEqual(resp.status_code, 403)

    def test_unauthenticated_blocked(self):
        resp = self.client.get(reverse("accounts:hod-faculty-list"))
        self.assertEqual(resp.status_code, 401)


# ── Faculty lifecycle ─────────────────────────────────────────────────────────

class FacultyLifecycleTests(APITestCase):
    def setUp(self):
        self.hod_user, self.dept = make_hod()
        resp = login(self.client, "hod@test.com")
        self.hod_token = resp.data["access"]

        # A pending faculty
        self.fac_user = make_faculty(
            email="lifecycle@test.com",
            approval=ApprovalStatus.PENDING, acct=AccountStatus.PENDING
        )
        self.fac_profile = Faculty.objects.get(user=self.fac_user)

        # Add an open semester and course for the "blocked from courses" test
        self.sem = Semester.objects.create(
            academic_year="2024-2025", semester_name=SemesterName.ODD,
            start_date="2024-07-01", end_date="2024-11-30",
            status=SemesterStatus.OPEN,
        )
        self.course = Course.objects.create(
            code="TC101", name="Test Course", department=self.dept,
            credits=3, capacity=30, status="Open",
        )

    def test_pending_faculty_cannot_create_offering(self):
        """New faculty cannot manage courses until HOD approves."""
        resp = login(self.client, "lifecycle@test.com")
        pend_token = resp.data["access"]
        resp = self.client.post(
            reverse("academics:offering-list"),
            {"course": self.course.pk, "faculty": self.fac_profile.pk,
             "semester": self.sem.pk, "capacity": 30},
            format="json",
            **auth_header(pend_token),
        )
        self.assertEqual(resp.status_code, 403)

    def test_approve_faculty(self):
        resp = self.client.post(
            reverse("accounts:hod-faculty-approve", kwargs={"pk": self.fac_profile.pk}),
            **auth_header(self.hod_token),
        )
        self.assertEqual(resp.status_code, 200)
        self.fac_profile.refresh_from_db()
        self.assertEqual(self.fac_profile.approval_status, ApprovalStatus.APPROVED)
        self.assertEqual(self.fac_profile.account_status, AccountStatus.ACTIVE)

    def test_reject_faculty(self):
        other = make_faculty(email="rej@test.com",
                             approval=ApprovalStatus.PENDING, acct=AccountStatus.PENDING)
        prof = Faculty.objects.get(user=other)
        resp = self.client.post(
            reverse("accounts:hod-faculty-reject", kwargs={"pk": prof.pk}),
            {"reason": "Not qualified."},
            format="json",
            **auth_header(self.hod_token),
        )
        self.assertEqual(resp.status_code, 200)
        prof.refresh_from_db()
        self.assertEqual(prof.approval_status, ApprovalStatus.REJECTED)

    def test_approved_faculty_can_view_courses(self):
        # Approve first
        self.fac_profile.approval_status = ApprovalStatus.APPROVED
        self.fac_profile.account_status  = AccountStatus.ACTIVE
        self.fac_profile.save()
        resp = login(self.client, "lifecycle@test.com")
        token = resp.data["access"]
        resp = self.client.get(
            reverse("academics:course-list"),
            **auth_header(token),
        )
        self.assertEqual(resp.status_code, 200)

    def test_deactivate_reactivate_faculty(self):
        # Approve first
        self.fac_profile.approval_status = ApprovalStatus.APPROVED
        self.fac_profile.account_status  = AccountStatus.ACTIVE
        self.fac_profile.save()
        # Deactivate
        resp = self.client.post(
            reverse("accounts:hod-faculty-deactivate", kwargs={"pk": self.fac_profile.pk}),
            **auth_header(self.hod_token),
        )
        self.assertEqual(resp.status_code, 200)
        self.fac_profile.refresh_from_db()
        self.assertEqual(self.fac_profile.account_status, AccountStatus.INACTIVE)
        # Re-activate
        resp = self.client.post(
            reverse("accounts:hod-faculty-activate", kwargs={"pk": self.fac_profile.pk}),
            **auth_header(self.hod_token),
        )
        self.assertEqual(resp.status_code, 200)
        self.fac_profile.refresh_from_db()
        self.assertEqual(self.fac_profile.account_status, AccountStatus.ACTIVE)


# ── Me endpoint ───────────────────────────────────────────────────────────────

class MeTests(APITestCase):
    def setUp(self):
        self.user = make_student()
        resp = login(self.client, "stu@test.com")
        self.token = resp.data["access"]

    def test_get_me(self):
        resp = self.client.get(reverse("accounts:me"), **auth_header(self.token))
        self.assertEqual(resp.status_code, 200)
        self.assertEqual(resp.data["email"], "stu@test.com")
        self.assertIn("profile", resp.data)

    def test_patch_name(self):
        resp = self.client.patch(
            reverse("accounts:me"),
            {"name": "Updated Name"},
            format="json",
            **auth_header(self.token),
        )
        self.assertEqual(resp.status_code, 200)

    def test_change_password(self):
        resp = self.client.patch(
            reverse("accounts:me"),
            {"old_password": "Pass@1234", "new_password": "NewPass@5678"},
            format="json",
            **auth_header(self.token),
        )
        self.assertEqual(resp.status_code, 200)
        self.user.refresh_from_db()
        self.assertTrue(self.user.check_password("NewPass@5678"))

    def test_wrong_old_password_rejected(self):
        resp = self.client.patch(
            reverse("accounts:me"),
            {"old_password": "Wrong!", "new_password": "NewPass@5678"},
            format="json",
            **auth_header(self.token),
        )
        self.assertEqual(resp.status_code, 400)
