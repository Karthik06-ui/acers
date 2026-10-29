"""academics/views.py"""
from django.db.models import Count, Q, Prefetch
from rest_framework import generics, filters, status
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from audit.services import log_action
from accounts.permissions import IsHOD, IsApprovedFaculty, IsHODOrApprovedFaculty

from .models import Department, Semester, Course, CourseOffering, CourseStatus
from .serializers import (
    DepartmentSerializer, SemesterSerializer,
    CourseSerializer, CourseWriteSerializer,
    CourseOfferingSerializer,
)


# ── Department ────────────────────────────────────────────────────────────────

class DepartmentListCreateView(generics.ListCreateAPIView):
    queryset         = Department.objects.all()
    serializer_class = DepartmentSerializer
    filter_backends  = [filters.SearchFilter, filters.OrderingFilter]
    search_fields    = ["name", "code"]
    ordering_fields  = ["name", "code"]

    def get_permissions(self):
        if self.request.method in ("POST",):
            return [IsHOD()]
        return [IsAuthenticated()]

    def perform_create(self, serializer):
        dept = serializer.save()
        log_action(self.request.user, "CREATE_DEPARTMENT", "academics.Department", dept.pk,
                   {"name": dept.name})


class DepartmentDetailView(generics.RetrieveUpdateDestroyAPIView):
    queryset         = Department.objects.all()
    serializer_class = DepartmentSerializer

    def get_permissions(self):
        if self.request.method in ("PUT", "PATCH", "DELETE"):
            return [IsHOD()]
        return [IsAuthenticated()]

    def perform_update(self, serializer):
        dept = serializer.save()
        log_action(self.request.user, "UPDATE_DEPARTMENT", "academics.Department", dept.pk, {})

    def perform_destroy(self, instance):
        log_action(self.request.user, "DELETE_DEPARTMENT", "academics.Department", instance.pk,
                   {"name": instance.name})
        instance.delete()


# ── Semester ──────────────────────────────────────────────────────────────────

class SemesterListCreateView(generics.ListCreateAPIView):
    queryset         = Semester.objects.all()
    serializer_class = SemesterSerializer
    filter_backends  = [filters.SearchFilter, filters.OrderingFilter]
    search_fields    = ["academic_year"]
    ordering_fields  = ["academic_year", "status"]

    def get_permissions(self):
        if self.request.method in ("POST",):
            return [IsHOD()]
        return [IsAuthenticated()]

    def perform_create(self, serializer):
        sem = serializer.save()
        log_action(self.request.user, "CREATE_SEMESTER", "academics.Semester", sem.pk,
                   {"academic_year": sem.academic_year, "name": sem.semester_name})


class SemesterDetailView(generics.RetrieveUpdateDestroyAPIView):
    queryset         = Semester.objects.all()
    serializer_class = SemesterSerializer

    def get_permissions(self):
        if self.request.method in ("PUT", "PATCH", "DELETE"):
            return [IsHOD()]
        return [IsAuthenticated()]

    def perform_update(self, serializer):
        sem = serializer.save()
        log_action(self.request.user, "UPDATE_SEMESTER", "academics.Semester", sem.pk, {})

    def perform_destroy(self, instance):
        log_action(self.request.user, "DELETE_SEMESTER", "academics.Semester", instance.pk, {})
        instance.delete()


# ── Course ────────────────────────────────────────────────────────────────────

class CourseListCreateView(generics.ListCreateAPIView):
    filter_backends = [filters.SearchFilter, filters.OrderingFilter]
    search_fields   = ["code", "name"]
    ordering_fields = ["code", "name", "credits", "minimum_cgpa"]

    def get_permissions(self):
        if self.request.method in ("POST",):
            return [IsHODOrApprovedFaculty()]
        return [IsAuthenticated()]

    def get_serializer_class(self):
        if self.request.method in ("POST",):
            return CourseWriteSerializer
        return CourseSerializer

    def get_queryset(self):
        qs = Course.objects.select_related("department").prefetch_related(
            Prefetch("offerings", queryset=CourseOffering.objects.select_related(
                "faculty", "semester"
            ).prefetch_related("enrollments"))
        )
        q = self.request.query_params
        if q.get("department"):
            qs = qs.filter(department__code=q["department"])
        if q.get("type"):
            qs = qs.filter(course_type=q["type"])
        if q.get("status"):
            qs = qs.filter(status=q["status"])
        if q.get("credits"):
            qs = qs.filter(credits=q["credits"])
        if q.get("min_cgpa_lte"):
            qs = qs.filter(
                Q(minimum_cgpa__lte=q["min_cgpa_lte"]) | Q(minimum_cgpa__isnull=True)
            )
        if q.get("has_seats") == "true":
            # Filter in Python after prefetch (avoids annotation complexity)
            pass  # handled in serializer / post-filter below
        return qs

    def list(self, request, *args, **kwargs):
        qs = self.filter_queryset(self.get_queryset())
        has_seats = request.query_params.get("has_seats")
        if has_seats == "true":
            qs = [c for c in qs if any(
                o.seats_available > 0 for o in c.offerings.all() if o.status == "Open"
            )]
        page = self.paginate_queryset(qs)
        if page is not None:
            ser = self.get_serializer(page, many=True, context={"request": request})
            return self.get_paginated_response(ser.data)
        ser = self.get_serializer(qs, many=True, context={"request": request})
        return Response(ser.data)

    def perform_create(self, serializer):
        # Faculty can only create in own department
        user = self.request.user
        if user.role == "FACULTY":
            try:
                dept = user.faculty_profile.department
            except Exception:
                dept = None
            serializer.save(department=dept)
        else:
            serializer.save()


class CourseDetailView(generics.RetrieveUpdateDestroyAPIView):
    queryset = Course.objects.select_related("department").prefetch_related(
        Prefetch("offerings", queryset=CourseOffering.objects.select_related(
            "faculty", "semester"
        ).prefetch_related("enrollments"))
    )

    def get_permissions(self):
        if self.request.method in ("PUT", "PATCH", "DELETE"):
            return [IsHODOrApprovedFaculty()]
        return [IsAuthenticated()]

    def get_serializer_class(self):
        if self.request.method in ("PUT", "PATCH"):
            return CourseWriteSerializer
        return CourseSerializer

    def get_serializer_context(self):
        ctx = super().get_serializer_context()
        ctx["request"] = self.request
        return ctx

    def destroy(self, request, *args, **kwargs):
        instance = self.get_object()
        # Archive instead of delete if offerings or enrollments exist
        has_offerings = instance.offerings.exists()
        has_enrollments = any(
            o.enrollments.exists() for o in instance.offerings.all()
        )
        if has_offerings or has_enrollments:
            instance.status = CourseStatus.ARCHIVED
            instance.save()
            log_action(request.user, "ARCHIVE_COURSE", "academics.Course", instance.pk,
                       {"code": instance.code})
            return Response({"detail": "Course archived (has existing offerings/enrollments)."})
        log_action(request.user, "DELETE_COURSE", "academics.Course", instance.pk,
                   {"code": instance.code})
        instance.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)


# ── CourseOffering ────────────────────────────────────────────────────────────

class CourseOfferingListCreateView(generics.ListCreateAPIView):
    serializer_class = CourseOfferingSerializer

    def get_permissions(self):
        if self.request.method in ("POST",):
            return [IsHOD()]
        return [IsAuthenticated()]

    def get_queryset(self):
        user = self.request.user
        qs   = CourseOffering.objects.select_related(
            "course", "faculty", "semester"
        ).prefetch_related("enrollments")

        # Faculty sees only own offerings
        if user.role == "FACULTY":
            try:
                qs = qs.filter(faculty=user.faculty_profile)
            except Exception:
                qs = qs.none()

        q = self.request.query_params
        if q.get("semester"):
            qs = qs.filter(semester__id=q["semester"])
        if q.get("faculty"):
            qs = qs.filter(faculty__id=q["faculty"])
        if q.get("course"):
            qs = qs.filter(course__id=q["course"])
        if q.get("status"):
            qs = qs.filter(status=q["status"])
        return qs


class CourseOfferingDetailView(generics.RetrieveUpdateDestroyAPIView):
    serializer_class = CourseOfferingSerializer
    queryset = CourseOffering.objects.select_related(
        "course", "faculty", "semester"
    ).prefetch_related("enrollments")

    def get_permissions(self):
        if self.request.method in ("PUT", "PATCH", "DELETE"):
            return [IsHOD()]
        return [IsAuthenticated()]

    def destroy(self, request, *args, **kwargs):
        instance = self.get_object()
        if instance.enrollments.exists():
            return Response(
                {"detail": "Cannot delete an offering that has enrollments."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        log_action(request.user, "DELETE_OFFERING", "academics.CourseOffering",
                   instance.pk, {"course": instance.course.code})
        instance.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)
