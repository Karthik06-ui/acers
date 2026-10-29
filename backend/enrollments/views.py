"""
enrollments/views.py
All views for Student, Faculty, and HOD enrollment management and dashboards.
Views only validate requests and delegate to services in enrollments/services.py.
"""
from decimal import Decimal
from django.db.models import Count, Q
from django.shortcuts import get_object_or_404
from django.utils import timezone
from rest_framework import generics, status
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.exceptions import ValidationError

from accounts.models import Student, Faculty, UserRole, ApprovalStatus, AccountStatus
from accounts.permissions import IsStudent, IsApprovedFaculty, IsHOD
from academics.models import CourseOffering, Course
from audit.models import AuditLog
from audit.services import log_action

from .models import EnrollmentRequest, Enrollment, AcademicRecord, RequestStatus, EnrollmentStatus
from .serializers import (
    EnrollmentRequestSerializer,
    EnrollmentRequestCreateSerializer,
    EnrollmentSerializer,
    AcademicRecordSerializer,
    AcademicRecordUpdateSerializer,
    ApproveRequestSerializer,
    RejectRequestSerializer,
    CompleteEnrollmentSerializer,
    HODOverrideSerializer,
)
from .services import (
    request_enrollment,
    approve_request,
    reject_request,
    withdraw_enrollment,
    complete_enrollment,
    hod_override,
    EnrollmentValidationError,
)


# ══════════════════════════════════════════════════════════════════════════════
# STUDENT VIEWS
# ══════════════════════════════════════════════════════════════════════════════

class StudentEnrollmentRequestListCreateView(generics.ListCreateAPIView):
    """
    POST: Submit an enrollment request for a course offering.
    GET:  List the student's own requests (filter by ?status=).
    """
    permission_classes = [IsStudent]

    def get_serializer_class(self):
        if self.request.method == "POST":
            return EnrollmentRequestCreateSerializer
        return EnrollmentRequestSerializer

    def get_queryset(self):
        student = self.request.user.student_profile
        qs = EnrollmentRequest.objects.filter(student=student).select_related(
            "student", "offering__course", "offering__faculty", "offering__semester", "reviewed_by"
        ).order_by("-request_date")
        req_status = self.request.query_params.get("status")
        if req_status:
            qs = qs.filter(status=req_status)
        return qs

    def create(self, request, *args, **kwargs):
        ser = self.get_serializer(data=request.data)
        ser.is_valid(raise_exception=True)
        offering = ser.validated_data["offering"]
        student = request.user.student_profile

        req = request_enrollment(student=student, offering=offering)
        out = EnrollmentRequestSerializer(req).data
        return Response(out, status=status.HTTP_201_CREATED)


class StudentEnrollmentWithdrawView(APIView):
    """POST /api/enrollments/<id>/withdraw/ — student withdraws an active enrollment."""
    permission_classes = [IsStudent]

    def post(self, request, pk, *args, **kwargs):
        student = request.user.student_profile
        enrollment = get_object_or_404(
            Enrollment.objects.select_related("offering__semester", "offering__course"),
            pk=pk,
            student=student,
        )
        updated = withdraw_enrollment(student=student, enrollment=enrollment)
        return Response(EnrollmentSerializer(updated).data, status=status.HTTP_200_OK)


class StudentMyEnrollmentsView(generics.ListAPIView):
    """GET /api/enrollments/my/ — list student's enrollments (filter by ?status=, ?semester=)."""
    permission_classes = [IsStudent]
    serializer_class = EnrollmentSerializer

    def get_queryset(self):
        student = self.request.user.student_profile
        qs = Enrollment.objects.filter(student=student).select_related(
            "student", "offering__course", "offering__faculty", "offering__semester"
        ).order_by("-enrollment_date")
        enroll_status = self.request.query_params.get("status")
        if enroll_status:
            qs = qs.filter(status=enroll_status)
        semester_id = self.request.query_params.get("semester")
        if semester_id:
            qs = qs.filter(offering__semester_id=semester_id)
        return qs


class StudentAcademicRecordView(APIView):
    """GET /api/academic-record/ — student's academic records and overall CGPA."""
    permission_classes = [IsStudent]

    def get(self, request, *args, **kwargs):
        student = request.user.student_profile
        records = AcademicRecord.objects.filter(student=student).select_related("semester").order_by(
            "-semester__academic_year", "semester__semester_name"
        )
        completed_enrollments = Enrollment.objects.filter(
            student=student, status=EnrollmentStatus.COMPLETED, grade_points__gte=4
        ).select_related("offering__course")
        total_credits_earned = sum(e.offering.course.credits for e in completed_enrollments)

        return Response({
            "student": {
                "id": student.id,
                "name": student.name,
                "roll_no": student.roll_no,
                "cgpa": str(student.cgpa),
                "total_credits_earned": total_credits_earned,
            },
            "records": AcademicRecordSerializer(records, many=True).data,
        })


class StudentDashboardView(APIView):
    """GET /api/student/dashboard/ — complete student dashboard metrics."""
    permission_classes = [IsStudent]

    def get(self, request, *args, **kwargs):
        student = request.user.student_profile
        active_enrollments = Enrollment.objects.filter(
            student=student, status=EnrollmentStatus.ACTIVE
        ).select_related("offering__course", "offering__faculty", "offering__semester")
        pending_requests_count = EnrollmentRequest.objects.filter(
            student=student, status=RequestStatus.PENDING
        ).count()

        completed = Enrollment.objects.filter(
            student=student, status=EnrollmentStatus.COMPLETED, grade_points__gte=4
        ).select_related("offering__course")
        credits_earned = sum(e.offering.course.credits for e in completed)

        # Recent status changes (last 5 requests or enrollments)
        recent_requests = EnrollmentRequest.objects.filter(student=student).select_related(
            "offering__course"
        ).order_by("-updated_at")[:5]

        status_changes = [
            {
                "id": r.id,
                "type": "request",
                "course_code": r.offering.course.code,
                "status": r.status,
                "updated_at": r.updated_at,
                "remarks": r.remarks,
            }
            for r in recent_requests
        ]

        active_courses = [
            {
                "enrollment_id": e.id,
                "course_code": e.offering.course.code,
                "course_name": e.offering.course.name,
                "credits": e.offering.course.credits,
                "faculty": e.offering.faculty.name,
                "semester": f"{e.offering.semester.academic_year} {e.offering.semester.semester_name}",
                "enrolled_date": e.enrollment_date,
            }
            for e in active_enrollments
        ]

        return Response({
            "profile": {
                "id": student.id,
                "name": student.name,
                "roll_no": student.roll_no,
                "email": request.user.email,
                "phone": student.phone,
                "year": student.year,
                "department": student.department.name if student.department else None,
                "status": student.status,
            },
            "cgpa": str(student.cgpa),
            "credits_earned": credits_earned,
            "active_count": active_enrollments.count(),
            "pending_requests": pending_requests_count,
            "recent_status_changes": status_changes,
            "active_courses": active_courses,
        })


# ══════════════════════════════════════════════════════════════════════════════
# FACULTY VIEWS
# ══════════════════════════════════════════════════════════════════════════════

class FacultyRequestsListView(generics.ListAPIView):
    """GET /api/faculty/requests/?status= — requests for courses taught by the faculty."""
    permission_classes = [IsApprovedFaculty]
    serializer_class = EnrollmentRequestSerializer

    def get_queryset(self):
        faculty = self.request.user.faculty_profile
        qs = EnrollmentRequest.objects.filter(offering__faculty=faculty).select_related(
            "student", "student__department", "offering__course", "offering__semester", "reviewed_by"
        ).order_by("-request_date")
        req_status = self.request.query_params.get("status")
        if req_status:
            qs = qs.filter(status=req_status)
        return qs


class FacultyRequestDetailView(generics.RetrieveAPIView):
    """GET /api/faculty/requests/<id>/ — detail of request with student info."""
    permission_classes = [IsApprovedFaculty]
    serializer_class = EnrollmentRequestSerializer

    def get_queryset(self):
        faculty = self.request.user.faculty_profile
        return EnrollmentRequest.objects.filter(offering__faculty=faculty).select_related(
            "student", "student__department", "offering__course", "offering__semester"
        )


class FacultyRequestApproveView(APIView):
    """POST /api/faculty/requests/<id>/approve/ — approve request."""
    permission_classes = [IsApprovedFaculty]

    def post(self, request, pk, *args, **kwargs):
        faculty = request.user.faculty_profile
        req = get_object_or_404(
            EnrollmentRequest.objects.select_related("offering", "student__user"),
            pk=pk,
            offering__faculty=faculty,
        )
        ser = ApproveRequestSerializer(data=request.data)
        ser.is_valid(raise_exception=True)
        remarks = ser.validated_data.get("remarks", "")

        enrollment = approve_request(actor=request.user, request=req, remarks=remarks)
        return Response(EnrollmentSerializer(enrollment).data, status=status.HTTP_200_OK)


class FacultyRequestRejectView(APIView):
    """POST /api/faculty/requests/<id>/reject/ — reject request."""
    permission_classes = [IsApprovedFaculty]

    def post(self, request, pk, *args, **kwargs):
        faculty = request.user.faculty_profile
        req = get_object_or_404(
            EnrollmentRequest.objects.select_related("offering", "student__user"),
            pk=pk,
            offering__faculty=faculty,
        )
        ser = RejectRequestSerializer(data=request.data)
        ser.is_valid(raise_exception=True)
        remarks = ser.validated_data.get("remarks")

        updated_req = reject_request(actor=request.user, request=req, remarks=remarks)
        return Response(EnrollmentRequestSerializer(updated_req).data, status=status.HTTP_200_OK)


class FacultyOfferingStudentsView(generics.ListAPIView):
    """GET /api/faculty/offerings/<id>/students/ — list enrolled students in offering."""
    permission_classes = [IsApprovedFaculty]
    serializer_class = EnrollmentSerializer

    def get_queryset(self):
        faculty = self.request.user.faculty_profile
        offering_id = self.kwargs.get("pk")
        get_object_or_404(CourseOffering, pk=offering_id, faculty=faculty)
        return Enrollment.objects.filter(
            offering_id=offering_id,
            status__in=[EnrollmentStatus.ACTIVE, EnrollmentStatus.COMPLETED]
        ).select_related("student", "student__department", "offering__course").order_by("student__roll_no")


class FacultyEnrollmentCompleteView(APIView):
    """POST /api/faculty/enrollments/<id>/complete/ — complete enrollment with grade points."""
    permission_classes = [IsApprovedFaculty]

    def post(self, request, pk, *args, **kwargs):
        faculty = request.user.faculty_profile
        enrollment = get_object_or_404(
            Enrollment.objects.select_related("offering__faculty", "offering__semester", "student"),
            pk=pk,
            offering__faculty=faculty,
        )
        ser = CompleteEnrollmentSerializer(data=request.data)
        ser.is_valid(raise_exception=True)
        gp = ser.validated_data["grade_points"]

        updated = complete_enrollment(actor=request.user, enrollment=enrollment, grade_points=gp)
        return Response(EnrollmentSerializer(updated).data, status=status.HTTP_200_OK)


class FacultyDashboardView(APIView):
    """GET /api/faculty/dashboard/ — metrics and offerings for the logged-in faculty."""
    permission_classes = [IsApprovedFaculty]

    def get(self, request, *args, **kwargs):
        faculty = request.user.faculty_profile
        offerings = CourseOffering.objects.filter(faculty=faculty).select_related(
            "course", "semester"
        ).order_by("-semester__academic_year", "course__code")

        total_active_students = Enrollment.objects.filter(
            offering__faculty=faculty, status=EnrollmentStatus.ACTIVE
        ).count()

        pending_requests_count = EnrollmentRequest.objects.filter(
            offering__faculty=faculty, status=RequestStatus.PENDING
        ).count()

        recent_requests = EnrollmentRequest.objects.filter(
            offering__faculty=faculty, status=RequestStatus.PENDING
        ).select_related("student", "offering__course").order_by("-request_date")[:5]

        offering_data = [
            {
                "id": o.id,
                "course_code": o.course.code,
                "course_name": o.course.name,
                "semester": f"{o.semester.academic_year} {o.semester.semester_name}",
                "capacity": o.capacity,
                "active_enrolled": o.active_enrollment_count,
                "seats_available": o.seats_available,
                "status": o.status,
            }
            for o in offerings
        ]

        return Response({
            "faculty": {
                "id": faculty.id,
                "name": faculty.name,
                "designation": faculty.designation,
                "department": faculty.department.name if faculty.department else None,
            },
            "offerings_count": offerings.count(),
            "active_students_count": total_active_students,
            "pending_requests_count": pending_requests_count,
            "offerings": offering_data,
            "recent_requests": EnrollmentRequestSerializer(recent_requests, many=True).data,
        })


# ══════════════════════════════════════════════════════════════════════════════
# HOD VIEWS
# ══════════════════════════════════════════════════════════════════════════════

class HODEnrollmentsListView(generics.ListAPIView):
    """GET /api/hod/enrollments/ — list all enrollments with filters."""
    permission_classes = [IsHOD]
    serializer_class = EnrollmentSerializer

    def get_queryset(self):
        qs = Enrollment.objects.select_related(
            "student", "offering__course", "offering__faculty", "offering__semester"
        ).order_by("-enrollment_date")
        s = self.request.query_params.get("status")
        if s:
            qs = qs.filter(status=s)
        sem = self.request.query_params.get("semester")
        if sem:
            qs = qs.filter(offering__semester_id=sem)
        course = self.request.query_params.get("course")
        if course:
            qs = qs.filter(offering__course_id=course)
        dept = self.request.query_params.get("department")
        if dept:
            qs = qs.filter(offering__course__department_id=dept)
        student_id = self.request.query_params.get("student")
        if student_id:
            qs = qs.filter(student_id=student_id)
        return qs


class HODRequestsListView(generics.ListAPIView):
    """GET /api/hod/requests/ — list all enrollment requests with filters."""
    permission_classes = [IsHOD]
    serializer_class = EnrollmentRequestSerializer

    def get_queryset(self):
        qs = EnrollmentRequest.objects.select_related(
            "student", "offering__course", "offering__faculty", "offering__semester", "reviewed_by"
        ).order_by("-request_date")
        s = self.request.query_params.get("status")
        if s:
            qs = qs.filter(status=s)
        sem = self.request.query_params.get("semester")
        if sem:
            qs = qs.filter(offering__semester_id=sem)
        course = self.request.query_params.get("course")
        if course:
            qs = qs.filter(offering__course_id=course)
        dept = self.request.query_params.get("department")
        if dept:
            qs = qs.filter(offering__course__department_id=dept)
        student_id = self.request.query_params.get("student")
        if student_id:
            qs = qs.filter(student_id=student_id)
        return qs


class HODOverrideView(APIView):
    """POST /api/hod/override/ — force approve/reject/withdraw with mandatory reason."""
    permission_classes = [IsHOD]

    def post(self, request, *args, **kwargs):
        ser = HODOverrideSerializer(data=request.data)
        ser.is_valid(raise_exception=True)
        data = ser.validated_data

        target_id = data["target_id"]
        target_type = data["target_type"]
        action = data["action"]
        reason = data["reason"]

        if target_type == "request":
            target = get_object_or_404(
                EnrollmentRequest.objects.select_related("offering", "student__user"),
                pk=target_id,
            )
        else:
            target = get_object_or_404(
                Enrollment.objects.select_related("offering", "student__user"),
                pk=target_id,
            )

        result = hod_override(actor=request.user, target=target, action=action, reason=reason)
        if isinstance(result, Enrollment):
            return Response(EnrollmentSerializer(result).data, status=status.HTTP_200_OK)
        return Response(EnrollmentRequestSerializer(result).data, status=status.HTTP_200_OK)


class HODStudentAcademicRecordView(APIView):
    """GET/PATCH /api/hod/academic-records/<student_id>/"""
    permission_classes = [IsHOD]

    def get(self, request, student_id, *args, **kwargs):
        student = get_object_or_404(Student, pk=student_id)
        records = AcademicRecord.objects.filter(student=student).select_related("semester").order_by(
            "-semester__academic_year"
        )
        return Response({
            "student": {
                "id": student.id,
                "name": student.name,
                "roll_no": student.roll_no,
                "cgpa": str(student.cgpa),
            },
            "records": AcademicRecordSerializer(records, many=True).data,
        })

    def patch(self, request, student_id, *args, **kwargs):
        student = get_object_or_404(Student, pk=student_id)
        record_id = request.data.get("record_id")
        cgpa = request.data.get("cgpa")

        updated_fields = {}
        if record_id:
            record = get_object_or_404(AcademicRecord, pk=record_id, student=student)
            ser = AcademicRecordUpdateSerializer(record, data=request.data, partial=True)
            ser.is_valid(raise_exception=True)
            ser.save()
            updated_fields["academic_record"] = ser.data

        if cgpa is not None:
            student.cgpa = Decimal(str(cgpa))
            student.save(update_fields=["cgpa"])
            updated_fields["cgpa"] = str(student.cgpa)

        log_action(
            actor=request.user,
            action="HOD_UPDATE_ACADEMIC_RECORD",
            target_type="accounts.Student",
            target_id=student.id,
            details={"updated": updated_fields},
        )
        return Response({"detail": "Academic record updated.", "data": updated_fields}, status=status.HTTP_200_OK)


class HODDashboardView(APIView):
    """GET /api/hod/dashboard/ — system totals, pending approvals, courses at capacity, audit logs."""
    permission_classes = [IsHOD]

    def get(self, request, *args, **kwargs):
        total_students = Student.objects.count()
        total_faculty = Faculty.objects.count()
        total_courses = Course.objects.count()
        total_active_enrollments = Enrollment.objects.filter(status=EnrollmentStatus.ACTIVE).count()

        pending_faculty_approvals = Faculty.objects.filter(approval_status=ApprovalStatus.PENDING).count()
        pending_requests_count = EnrollmentRequest.objects.filter(status=RequestStatus.PENDING).count()

        # Active course offerings count
        total_active_offerings = CourseOffering.objects.filter(status="Open").count()

        # Courses/offerings at capacity — avoid N+1 via annotation
        offerings = (
            CourseOffering.objects
            .select_related("course", "faculty", "semester")
            .annotate(active_count=Count("enrollments", filter=Q(enrollments__status=EnrollmentStatus.ACTIVE)))
        )
        courses_at_capacity = [
            {
                "offering_id": o.id,
                "course_code": o.course.code,
                "course_name": o.course.name,
                "faculty": o.faculty.name,
                "capacity": o.capacity,
                "active_enrolled": o.active_count,
            }
            for o in offerings
            if o.active_count >= o.capacity
        ]

        # Enrollment by course (top 10)
        enroll_by_course = (
            Enrollment.objects
            .filter(status=EnrollmentStatus.ACTIVE)
            .values("offering__course__code")
            .annotate(count=Count("id"))
            .order_by("-count")[:10]
        )
        enrollment_by_course = [
            {"course_code": r["offering__course__code"], "count": r["count"]}
            for r in enroll_by_course
        ]

        # Enrollment by department (active enrollments)
        enroll_by_dept = (
            Enrollment.objects
            .filter(status=EnrollmentStatus.ACTIVE)
            .values("offering__course__department__code")
            .annotate(count=Count("id"))
            .order_by("-count")
        )
        enrollment_by_department = [
            {"dept_code": r["offering__course__department__code"] or "N/A", "count": r["count"]}
            for r in enroll_by_dept
        ]

        last_10_audit = AuditLog.objects.select_related("actor").order_by("-created_at")[:10]
        audit_data = [
            {
                "id": a.id,
                "actor_email": a.actor.email if a.actor else "SYSTEM",
                "action": a.action,
                "target_type": a.target_type,
                "target_id": a.target_id,
                "details": a.details,
                "created_at": a.created_at,
            }
            for a in last_10_audit
        ]

        return Response({
            "totals": {
                "students": total_students,
                "faculty": total_faculty,
                "courses": total_courses,
                "active_enrollments": total_active_enrollments,
                "active_offerings": total_active_offerings,
            },
            "pending_faculty_approvals": pending_faculty_approvals,
            "pending_requests_count": pending_requests_count,
            "courses_at_capacity": courses_at_capacity,
            "enrollment_by_course": enrollment_by_course,
            "enrollment_by_department": enrollment_by_department,
            "last_10_audit_entries": audit_data,
        })
