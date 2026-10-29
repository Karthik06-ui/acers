"""
accounts/tests/test_security.py

Security pass:
- Swapped-ID isolation: users cannot read/write other users' data
- Passwords never returned in responses
- Permission class coverage on every sensitive endpoint
- HOD dashboard requires HOD role
- Student cannot access faculty endpoints and vice-versa
- Faculty cannot access other faculty's student list
"""
from django.urls import reverse
from rest_framework import status
from rest_framework.test import APITestCase

from accounts.models import (
    User, Student, Faculty, HOD,
    UserRole, UserStatus, ApprovalStatus, AccountStatus,
)
from academics.models import Department, Semester, Course, CourseOffering, SemesterName, SemesterStatus
from enrollments.models import EnrollmentRequest, Enrollment, RequestStatus, EnrollmentStatus


# ── helpers ────────────────────────────────────────────────────────────────────

def make_hod(email="hod@sec.com", password="Pass@1234"):
    dept, _ = Department.objects.get_or_create(code="SEC", defaults={"name": "Security Dept"})
    u = User.objects.create_user(email=email, password=password,
                                  role=UserRole.HOD, status=UserStatus.ACTIVE)
    HOD.objects.create(user=u, name="Security HOD", department=dept, status="Active")
    return u, dept


def make_student(email="stu@sec.com", password="Pass@1234", roll="SEC001"):
    dept, _ = Department.objects.get_or_create(code="SEC", defaults={"name": "Security Dept"})
    u = User.objects.create_user(email=email, password=password,
                                  role=UserRole.STUDENT, status=UserStatus.ACTIVE)
    Student.objects.create(user=u, name="Sec Student", roll_no=roll, department=dept)
    return u


def make_faculty(email="fac@sec.com", password="Pass@1234",
                 approval=ApprovalStatus.APPROVED, acct=AccountStatus.ACTIVE):
    dept, _ = Department.objects.get_or_create(code="SEC", defaults={"name": "Security Dept"})
    u = User.objects.create_user(email=email, password=password,
                                  role=UserRole.FACULTY, status=UserStatus.ACTIVE)
    Faculty.objects.create(user=u, name="Sec Faculty", department=dept,
                            approval_status=approval, account_status=acct)
    return u


def login_token(client, email, password="Pass@1234"):
    resp = client.post(reverse("accounts:login"), {"email": email, "password": password}, format="json")
    return resp.data.get("access")


def auth(token):
    return {"HTTP_AUTHORIZATION": f"Bearer {token}"}


# ── Password never in responses ─────────────────────────────────────────────────

class PasswordNeverExposedTests(APITestCase):
    def setUp(self):
        self.stu = make_student()
        self.token = login_token(self.client, "stu@sec.com")

    def test_me_no_password(self):
        resp = self.client.get(reverse("accounts:me"), **auth(self.token))
        self.assertEqual(resp.status_code, 200)
        body = str(resp.data)
        self.assertNotIn("Pass@1234", body)
        self.assertNotIn("\"password\"", body.lower())

    def test_login_no_password_in_response(self):
        resp = self.client.post(reverse("accounts:login"),
                                {"email": "stu@sec.com", "password": "Pass@1234"}, format="json")
        self.assertEqual(resp.status_code, 200)
        self.assertNotIn("Pass@1234", str(resp.data))

    def test_register_no_password_in_response(self):
        resp = self.client.post(reverse("accounts:register-student"), {
            "email": "newstu@sec.com", "password": "Pass@1234", "name": "New", "roll_no": "SEC999",
        }, format="json")
        self.assertNotIn("Pass@1234", str(resp.data))


# ── Swapped-ID isolation ────────────────────────────────────────────────────────

class SwappedIDTests(APITestCase):
    """Users cannot read or write other users' resources."""

    def setUp(self):
        self.hod_u, self.dept = make_hod()
        self.stu1 = make_student(email="stu1@sec.com", roll="SEC100")
        self.stu2 = make_student(email="stu2@sec.com", roll="SEC101")
        self.fac1 = make_faculty(email="fac1@sec.com")
        self.fac2 = make_faculty(email="fac2@sec.com")
        self.hod_token = login_token(self.client, "hod@sec.com")
        self.stu1_token = login_token(self.client, "stu1@sec.com")
        self.stu2_token = login_token(self.client, "stu2@sec.com")
        self.fac1_token = login_token(self.client, "fac1@sec.com")
        self.fac2_token = login_token(self.client, "fac2@sec.com")

        self.sem = Semester.objects.create(
            academic_year="2024-2025", semester_name=SemesterName.ODD,
            start_date="2024-07-01", end_date="2024-11-30", status=SemesterStatus.OPEN,
        )
        self.course = Course.objects.create(
            code="SEC101", name="Security Course", credits=3, capacity=30,
            department=self.dept, status="Open",
        )
        self.fac1_profile = Faculty.objects.get(user=self.fac1)
        self.fac2_profile = Faculty.objects.get(user=self.fac2)
        self.offering = CourseOffering.objects.create(
            course=self.course, faculty=self.fac1_profile,
            semester=self.sem, capacity=30, status="Open",
        )

    def test_student_cannot_access_hod_student_detail(self):
        """Student cannot reach HOD-only student detail endpoint."""
        stu2_profile = Student.objects.get(user=self.stu2)
        url = reverse("accounts:hod-student-detail", kwargs={"pk": stu2_profile.pk})
        resp = self.client.get(url, **auth(self.stu1_token))
        self.assertEqual(resp.status_code, 403)

    def test_student_cannot_patch_other_student_via_hod(self):
        stu2_profile = Student.objects.get(user=self.stu2)
        url = reverse("accounts:hod-student-detail", kwargs={"pk": stu2_profile.pk})
        resp = self.client.patch(url, {"name": "Hacked"}, format="json", **auth(self.stu1_token))
        self.assertEqual(resp.status_code, 403)
        stu2_profile.refresh_from_db()
        self.assertNotEqual(stu2_profile.name, "Hacked")

    def test_faculty_cannot_view_other_facultys_offering_students(self):
        """fac2 cannot list students for fac1's offering."""
        url = reverse("faculty:offering-students", kwargs={"pk": self.offering.pk})
        resp = self.client.get(url, **auth(self.fac2_token))
        self.assertEqual(resp.status_code, 404)  # 404 because get_object_or_404 scoped to fac2

    def test_student_cannot_withdraw_other_students_enrollment(self):
        """stu1 cannot withdraw stu2's enrollment — 404 because enrollment not in stu1's queryset."""
        stu2_profile = Student.objects.get(user=self.stu2)
        req = EnrollmentRequest.objects.create(
            student=stu2_profile, offering=self.offering, status=RequestStatus.APPROVED
        )
        from enrollments.models import Enrollment as Enroll
        enroll = Enroll.objects.create(
            student=stu2_profile, offering=self.offering,
            request=req, status=EnrollmentStatus.ACTIVE,
        )
        # The withdraw URL path is /api/enrollments/<pk>/withdraw/ — namespace "enrollments"
        # Pattern name from urls.py is "enrollment-withdraw"
        url = f"/api/enrollments/{enroll.pk}/withdraw/"
        resp = self.client.post(url, **auth(self.stu1_token))
        self.assertNotEqual(resp.status_code, 200)
        enroll.refresh_from_db()
        self.assertEqual(enroll.status, EnrollmentStatus.ACTIVE)

    def test_faculty_approve_other_facultys_request_blocked(self):
        """fac2 cannot approve a request for fac1's offering — 404."""
        stu1_profile = Student.objects.get(user=self.stu1)
        req = EnrollmentRequest.objects.create(
            student=stu1_profile, offering=self.offering, status=RequestStatus.PENDING
        )
        url = reverse("faculty:request-approve", kwargs={"pk": req.pk})
        resp = self.client.post(url, {}, format="json", **auth(self.fac2_token))
        self.assertEqual(resp.status_code, 404)

    def test_hod_academic_record_blocked_for_student(self):
        stu1_profile = Student.objects.get(user=self.stu1)
        url = reverse("hod:academic-records", kwargs={"student_id": stu1_profile.pk})
        resp = self.client.get(url, **auth(self.stu1_token))
        self.assertEqual(resp.status_code, 403)

    def test_hod_academic_record_blocked_for_faculty(self):
        stu1_profile = Student.objects.get(user=self.stu1)
        url = reverse("hod:academic-records", kwargs={"student_id": stu1_profile.pk})
        resp = self.client.get(url, **auth(self.fac1_token))
        self.assertEqual(resp.status_code, 403)

    def test_student_cannot_list_all_enrollments_via_hod(self):
        """Student cannot call the HOD enrollment list endpoint."""
        resp = self.client.get(reverse("hod:enrollments-list"), **auth(self.stu1_token))
        self.assertEqual(resp.status_code, 403)

    def test_faculty_cannot_list_all_enrollments_via_hod(self):
        resp = self.client.get(reverse("hod:enrollments-list"), **auth(self.fac1_token))
        self.assertEqual(resp.status_code, 403)


# ── Permission class coverage ──────────────────────────────────────────────────

class PermissionCoverageTests(APITestCase):
    """Every sensitive HOD endpoint requires the HOD role."""

    def setUp(self):
        self.hod_u, self.dept = make_hod()
        self.stu_u = make_student(email="stu99@sec.com", roll="SEC999")
        self.fac_u = make_faculty(email="fac99@sec.com")
        self.hod_token = login_token(self.client, "hod@sec.com")
        self.stu_token = login_token(self.client, "stu99@sec.com")
        self.fac_token = login_token(self.client, "fac99@sec.com")

    def _assert_non_hod_blocked(self, url, method="get"):
        for name, token in [("student", self.stu_token), ("faculty", self.fac_token)]:
            resp = getattr(self.client, method)(url, **auth(token))
            self.assertIn(
                resp.status_code, [403, 404, 405],
                f"{method.upper()} {url} returned {resp.status_code} for {name} — expected 403/404/405"
            )

    def _assert_hod_ok(self, url, method="get"):
        resp = getattr(self.client, method)(url, **auth(self.hod_token))
        self.assertNotIn(resp.status_code, [401, 403],
                         f"{method.upper()} {url} returned {resp.status_code} for HOD")

    def test_hod_faculty_list(self):
        url = reverse("accounts:hod-faculty-list")
        self._assert_non_hod_blocked(url)
        self._assert_hod_ok(url)

    def test_hod_student_list(self):
        url = reverse("accounts:hod-student-list")
        self._assert_non_hod_blocked(url)
        self._assert_hod_ok(url)

    def test_hod_dashboard(self):
        url = reverse("hod:dashboard")
        self._assert_non_hod_blocked(url)
        self._assert_hod_ok(url)

    def test_hod_enrollments_list(self):
        url = reverse("hod:enrollments-list")
        self._assert_non_hod_blocked(url)
        self._assert_hod_ok(url)

    def test_hod_requests_list(self):
        url = reverse("hod:requests-list")
        self._assert_non_hod_blocked(url)
        self._assert_hod_ok(url)

    def test_hod_audit_logs(self):
        url = reverse("hod:audit-logs")
        self._assert_non_hod_blocked(url)
        self._assert_hod_ok(url)

    def test_hod_reports(self):
        url = reverse("hod:reports")
        self._assert_non_hod_blocked(url)
        self._assert_hod_ok(url)

    def test_unauthenticated_blocked_on_hod_endpoints(self):
        for name, url_name in [
            ("faculty-list", "accounts:hod-faculty-list"),
            ("student-list", "accounts:hod-student-list"),
            ("dashboard", "hod:dashboard"),
            ("enrollments", "hod:enrollments-list"),
            ("audit-logs", "hod:audit-logs"),
        ]:
            resp = self.client.get(reverse(url_name))
            self.assertEqual(resp.status_code, 401, f"{name} should require auth")


# ── HOD dashboard data completeness ───────────────────────────────────────────

class HODDashboardTests(APITestCase):
    def setUp(self):
        self.hod_u, self.dept = make_hod()
        self.hod_token = login_token(self.client, "hod@sec.com")
        make_student(email="dashstu@sec.com", roll="DASH001")
        make_faculty(email="dashfac@sec.com",
                     approval=ApprovalStatus.PENDING, acct=AccountStatus.PENDING)

    def test_dashboard_returns_all_required_fields(self):
        resp = self.client.get(reverse("hod:dashboard"), **auth(self.hod_token))
        self.assertEqual(resp.status_code, 200)
        data = resp.data
        self.assertIn("totals", data)
        self.assertIn("pending_faculty_approvals", data)
        self.assertIn("pending_requests_count", data)
        self.assertIn("enrollment_by_course", data)
        self.assertIn("enrollment_by_department", data)
        self.assertIn("last_10_audit_entries", data)
        self.assertGreaterEqual(data["totals"]["students"], 1)
        self.assertGreaterEqual(data["pending_faculty_approvals"], 1)
        self.assertIsInstance(data["enrollment_by_course"], list)
        self.assertIsInstance(data["enrollment_by_department"], list)
        # active_offerings in totals
        self.assertIn("active_offerings", data["totals"])
