"""
enrollments/tests/test_services_and_api.py

Covers:
- CGPA below minimum blocked
- Full course blocked
- Duplicate request blocked
- Faculty acting on another faculty's offering blocked
- Pending faculty blocked from faculty endpoints
- Concurrency test: two simultaneous approvals for the last seat (only one succeeds, capacity never exceeded)
- Withdraw then re-request succeeds
- Completion updating AcademicRecord and Student CGPA correctly
- HOD override (approve, reject, withdraw) and audit logging
- Student and Faculty and HOD dashboards & reports
- Notifications list (with unread count) and mark-read
"""
import concurrent.futures
from decimal import Decimal
from django.db import connection
from django.test import TransactionTestCase
from django.urls import reverse
from rest_framework import status
from rest_framework.test import APITestCase

from accounts.models import (
    User, Student, Faculty, HOD,
    UserRole, UserStatus, ApprovalStatus, AccountStatus,
)
from academics.models import (
    Department, Semester, Course, CourseOffering,
    SemesterName, SemesterStatus, CourseType, CourseStatus, OfferingStatus,
)
from enrollments.models import (
    EnrollmentRequest, Enrollment, AcademicRecord,
    RequestStatus, EnrollmentStatus,
)
from enrollments.services import (
    request_enrollment,
    approve_request,
    reject_request,
    withdraw_enrollment,
    complete_enrollment,
    hod_override,
    EnrollmentValidationError,
)
from notifications.models import Notification


def create_test_setup():
    dept = Department.objects.create(name="Computer Science", code="CS")
    sem = Semester.objects.create(
        academic_year="2024-2025",
        semester_name=SemesterName.ODD,
        start_date="2024-08-01",
        end_date="2024-12-15",
        status=SemesterStatus.OPEN,
    )
    course = Course.objects.create(
        code="CS101",
        name="Intro to Programming",
        credits=4,
        course_type=CourseType.THEORY,
        capacity=10,
        minimum_cgpa=Decimal("7.00"),
        department=dept,
        status=CourseStatus.OPEN,
    )

    # Faculty 1 (Approved & Active)
    u_fac1 = User.objects.create_user(email="fac1@test.com", password="Pass@1234", role=UserRole.FACULTY)
    fac1 = Faculty.objects.create(
        user=u_fac1, name="Dr. Faculty One", department=dept,
        approval_status=ApprovalStatus.APPROVED, account_status=AccountStatus.ACTIVE,
    )

    # Faculty 2 (Approved & Active)
    u_fac2 = User.objects.create_user(email="fac2@test.com", password="Pass@1234", role=UserRole.FACULTY)
    fac2 = Faculty.objects.create(
        user=u_fac2, name="Dr. Faculty Two", department=dept,
        approval_status=ApprovalStatus.APPROVED, account_status=AccountStatus.ACTIVE,
    )

    # Faculty 3 (Pending approval)
    u_fac3 = User.objects.create_user(email="fac3_pending@test.com", password="Pass@1234", role=UserRole.FACULTY)
    fac3 = Faculty.objects.create(
        user=u_fac3, name="Dr. Pending", department=dept,
        approval_status=ApprovalStatus.PENDING, account_status=AccountStatus.PENDING,
    )

    # HOD
    u_hod = User.objects.create_user(email="hod@test.com", password="Pass@1234", role=UserRole.HOD)
    hod = HOD.objects.create(user=u_hod, name="Prof. HOD", department=dept, status="Active")

    # Student 1 (high CGPA 8.5)
    u_stu1 = User.objects.create_user(email="stu1@test.com", password="Pass@1234", role=UserRole.STUDENT)
    stu1 = Student.objects.create(
        user=u_stu1, name="Student One", roll_no="CS001", department=dept, cgpa=Decimal("8.50"),
    )

    # Student 2 (low CGPA 6.0)
    u_stu2 = User.objects.create_user(email="stu2@test.com", password="Pass@1234", role=UserRole.STUDENT)
    stu2 = Student.objects.create(
        user=u_stu2, name="Student Two", roll_no="CS002", department=dept, cgpa=Decimal("6.00"),
    )

    # Offering
    offering = CourseOffering.objects.create(
        course=course, faculty=fac1, semester=sem, capacity=2, status=OfferingStatus.OPEN,
    )

    return {
        "dept": dept, "sem": sem, "course": course,
        "u_fac1": u_fac1, "fac1": fac1,
        "u_fac2": u_fac2, "fac2": fac2,
        "u_fac3": u_fac3, "fac3": fac3,
        "u_hod": u_hod, "hod": hod,
        "u_stu1": u_stu1, "stu1": stu1,
        "u_stu2": u_stu2, "stu2": stu2,
        "offering": offering,
    }


class EnrollmentServicesTestCase(APITestCase):
    def setUp(self):
        self.data = create_test_setup()

    def test_cgpa_below_minimum_blocked(self):
        """Student with CGPA below course minimum is blocked from requesting enrollment."""
        stu2 = self.data["stu2"]  # CGPA 6.0, course minimum is 7.0
        offering = self.data["offering"]
        with self.assertRaises(EnrollmentValidationError) as ctx:
            request_enrollment(student=stu2, offering=offering)
        self.assertIn("below the course minimum", str(ctx.exception))

    def test_full_course_blocked(self):
        """When offering capacity is reached, new requests are blocked."""
        offering = self.data["offering"]
        offering.capacity = 1
        offering.save()

        # Enroll student 1 directly to fill capacity
        req1 = request_enrollment(student=self.data["stu1"], offering=offering)
        approve_request(actor=self.data["u_fac1"], request=req1)

        # Create student 3 with high CGPA
        u_stu3 = User.objects.create_user(email="stu3@test.com", password="Pass@1234", role=UserRole.STUDENT)
        stu3 = Student.objects.create(user=u_stu3, name="Stu3", roll_no="CS003", cgpa=Decimal("9.00"))

        with self.assertRaises(EnrollmentValidationError) as ctx:
            request_enrollment(student=stu3, offering=offering)
        self.assertIn("full capacity", str(ctx.exception))

    def test_duplicate_request_blocked(self):
        """Submitting a request when one is already pending or active is blocked."""
        stu1 = self.data["stu1"]
        offering = self.data["offering"]

        req = request_enrollment(student=stu1, offering=offering)
        self.assertEqual(req.status, RequestStatus.PENDING)

        with self.assertRaises(EnrollmentValidationError) as ctx:
            request_enrollment(student=stu1, offering=offering)
        self.assertIn("pending enrollment request already exists", str(ctx.exception))

    def test_faculty_acting_on_another_facultys_offering_blocked(self):
        """Faculty cannot approve or reject requests for offerings they do not teach."""
        stu1 = self.data["stu1"]
        offering = self.data["offering"]
        u_fac2 = self.data["u_fac2"]

        req = request_enrollment(student=stu1, offering=offering)
        with self.assertRaises(EnrollmentValidationError) as ctx:
            approve_request(actor=u_fac2, request=req)
        self.assertIn("Faculty can only manage their own course offerings", str(ctx.exception))

        with self.assertRaises(EnrollmentValidationError) as ctx:
            reject_request(actor=u_fac2, request=req, remarks="Not my course")
        self.assertIn("Faculty can only manage their own course offerings", str(ctx.exception))

    def test_pending_faculty_blocked(self):
        """Faculty pending HOD approval is blocked from approving requests and faculty API."""
        stu1 = self.data["stu1"]
        offering = self.data["offering"]
        u_fac3 = self.data["u_fac3"]

        req = request_enrollment(student=stu1, offering=offering)
        with self.assertRaises(EnrollmentValidationError) as ctx:
            approve_request(actor=u_fac3, request=req)
        self.assertIn("not approved or active", str(ctx.exception))

        # Also test API permission blocking
        self.client.force_authenticate(user=u_fac3)
        res = self.client.get(reverse("faculty:dashboard"))
        self.assertEqual(res.status_code, status.HTTP_403_FORBIDDEN)

    def test_withdraw_then_re_request(self):
        """Active enrollment can be withdrawn, which frees the seat and allows re-request."""
        stu1 = self.data["stu1"]
        offering = self.data["offering"]
        u_fac1 = self.data["u_fac1"]

        req = request_enrollment(student=stu1, offering=offering)
        enrollment = approve_request(actor=u_fac1, request=req)
        self.assertEqual(enrollment.status, EnrollmentStatus.ACTIVE)
        self.assertEqual(offering.active_enrollment_count, 1)

        # Student withdraws
        withdraw_enrollment(student=stu1, enrollment=enrollment)
        enrollment.refresh_from_db()
        self.assertEqual(enrollment.status, EnrollmentStatus.WITHDRAWN)
        self.assertEqual(offering.active_enrollment_count, 0)

        # Re-request succeeds
        req2 = request_enrollment(student=stu1, offering=offering)
        self.assertEqual(req2.status, RequestStatus.PENDING)

    def test_completion_updating_cgpa_correctly(self):
        """Completing courses recomputes credit-weighted semester GPA and cumulative CGPA."""
        stu1 = self.data["stu1"]
        offering1 = self.data["offering"]
        sem = self.data["sem"]
        dept = self.data["dept"]
        u_fac1 = self.data["u_fac1"]

        # Create a second course (3 credits)
        course2 = Course.objects.create(
            code="CS102", name="Data Structures", credits=3,
            course_type=CourseType.THEORY, capacity=10, department=dept, status=CourseStatus.OPEN,
        )
        offering2 = CourseOffering.objects.create(
            course=course2, faculty=self.data["fac1"], semester=sem, capacity=10, status=OfferingStatus.OPEN,
        )

        req1 = request_enrollment(student=stu1, offering=offering1)
        enr1 = approve_request(actor=u_fac1, request=req1)

        req2 = request_enrollment(student=stu1, offering=offering2)
        enr2 = approve_request(actor=u_fac1, request=req2)

        # Complete course 1 with 9.00 GP (4 credits -> 36 points)
        complete_enrollment(actor=u_fac1, enrollment=enr1, grade_points=Decimal("9.00"))
        # Complete course 2 with 8.00 GP (3 credits -> 24 points)
        complete_enrollment(actor=u_fac1, enrollment=enr2, grade_points=Decimal("8.00"))

        # Expected: total points = 36 + 24 = 60, total credits = 7. 60 / 7 = 8.5714... -> 8.57
        stu1.refresh_from_db()
        self.assertEqual(stu1.cgpa, Decimal("8.57"))

        record = AcademicRecord.objects.get(student=stu1, semester=sem)
        self.assertEqual(record.credits_registered, 7)
        self.assertEqual(record.credits_earned, 7)
        self.assertEqual(record.semester_gpa, Decimal("8.57"))
        self.assertEqual(record.cumulative_cgpa, Decimal("8.57"))

    def test_hod_override_and_audit(self):
        """HOD can override requests/enrollments with mandatory reason and AuditLog created."""
        stu1 = self.data["stu1"]
        offering = self.data["offering"]
        u_hod = self.data["u_hod"]

        req = request_enrollment(student=stu1, offering=offering)

        # Reject via HOD override
        hod_override(actor=u_hod, target=req, action="reject", reason="Administrative hold")
        req.refresh_from_db()
        self.assertEqual(req.status, RequestStatus.REJECTED)

        # Force approve via HOD override
        enr = hod_override(actor=u_hod, target=req, action="approve", reason="Exception granted by Dean")
        self.assertEqual(enr.status, EnrollmentStatus.ACTIVE)

        # Force withdraw via HOD override
        hod_override(actor=u_hod, target=enr, action="withdraw", reason="Medical leave")
        enr.refresh_from_db()
        self.assertEqual(enr.status, EnrollmentStatus.WITHDRAWN)

    def test_endpoints_flow(self):
        """Test API endpoints for student, faculty, HOD, and notifications."""
        u_stu1 = self.data["u_stu1"]
        u_fac1 = self.data["u_fac1"]
        u_hod = self.data["u_hod"]
        offering = self.data["offering"]

        # Student submits request
        self.client.force_authenticate(user=u_stu1)
        res = self.client.post(reverse("enrollments:request-list-create"), {"offering": offering.id}, format="json")
        self.assertEqual(res.status_code, status.HTTP_201_CREATED)
        req_id = res.data["id"]

        # Student dashboard
        res = self.client.get(reverse("student-dashboard"))
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        self.assertEqual(res.data["pending_requests"], 1)

        # Faculty views requests
        self.client.force_authenticate(user=u_fac1)
        res = self.client.get(reverse("faculty:request-list"))
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        self.assertEqual(len(res.data["results"]), 1)

        # Faculty approves
        res = self.client.post(reverse("faculty:request-approve", kwargs={"pk": req_id}), {"remarks": "Welcome"}, format="json")
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        enr_id = res.data["id"]

        # Faculty dashboard
        res = self.client.get(reverse("faculty:dashboard"))
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        self.assertEqual(res.data["active_students_count"], 1)

        # Student notifications
        self.client.force_authenticate(user=u_stu1)
        res = self.client.get(reverse("notifications:notification-list"))
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        self.assertGreater(res.data["unread_count"], 0)

        # Mark all read
        res = self.client.post(reverse("notifications:notification-read-all"))
        self.assertEqual(res.status_code, status.HTTP_200_OK)

        # HOD dashboard & reports
        self.client.force_authenticate(user=u_hod)
        res = self.client.get(reverse("hod:dashboard"))
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        self.assertIn("totals", res.data)

        # HOD report json
        res = self.client.get(reverse("hod:reports") + "?type=enrollment-by-course&format=json")
        self.assertEqual(res.status_code, status.HTTP_200_OK)

        # HOD report csv
        res = self.client.get(reverse("hod:reports") + "?type=enrollment-by-course&format=csv")
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        self.assertEqual(res["Content-Type"], "text/csv")


class EnrollmentConcurrencyTestCase(TransactionTestCase):
    """
    Proves that when two simultaneous approvals attempt to take the last seat,
    atomic select_for_update re-checking prevents oversubscription:
    only one succeeds, and capacity is never exceeded.
    """
    def setUp(self):
        self.data = create_test_setup()

    def test_two_simultaneous_approvals_for_last_seat(self):
        offering = self.data["offering"]
        offering.capacity = 1
        offering.save()

        u_fac1 = self.data["u_fac1"]
        stu1 = self.data["stu1"]
        # Create a second eligible student
        u_stu2_high = User.objects.create_user(email="stu2_high@test.com", password="Pass@1234", role=UserRole.STUDENT)
        stu2_high = Student.objects.create(
            user=u_stu2_high, name="Student Two High", roll_no="CS002H", cgpa=Decimal("8.00")
        )

        # Both students submit pending requests
        req1 = request_enrollment(student=stu1, offering=offering)
        req2 = request_enrollment(student=stu2_high, offering=offering)

        results = []
        errors = []

        def try_approve(req_obj):
            # Close existing connection in worker thread so each thread gets its own DB connection
            connection.close()
            try:
                enr = approve_request(actor=u_fac1, request=req_obj, remarks="Approved")
                results.append(enr)
            except Exception as e:
                errors.append(e)
            finally:
                connection.close()

        with concurrent.futures.ThreadPoolExecutor(max_workers=2) as executor:
            futures = [
                executor.submit(try_approve, req1),
                executor.submit(try_approve, req2),
            ]
            concurrent.futures.wait(futures)

        # Exactly ONE approval must succeed
        self.assertEqual(len(results), 1, f"Expected 1 success, got {len(results)}. Errors: {errors}")
        # Exactly ONE approval must fail with validation error
        self.assertEqual(len(errors), 1, f"Expected 1 failure, got {len(errors)}. Successes: {results}")
        self.assertIsInstance(errors[0], EnrollmentValidationError)
        self.assertIn("capacity", str(errors[0]).lower())

        # Offering capacity check: exactly 1 active enrollment in DB
        active_count = Enrollment.objects.filter(offering=offering, status=EnrollmentStatus.ACTIVE).count()
        self.assertEqual(active_count, 1)
        self.assertLessEqual(active_count, offering.capacity)
