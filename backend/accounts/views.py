"""accounts/views.py"""
from django.db import transaction
from rest_framework import generics, status
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework_simplejwt.tokens import RefreshToken
from rest_framework_simplejwt.views import TokenObtainPairView
from rest_framework_simplejwt.exceptions import TokenError

from audit.services import log_action
from .models import User, Faculty, Student, UserRole, ApprovalStatus, AccountStatus, UserStatus
from .permissions import IsHOD, IsOwnerOrHOD
from .serializers import (
    CustomTokenObtainPairSerializer,
    StudentRegisterSerializer,
    FacultyRegisterSerializer,
    MeSerializer,
    FacultyListSerializer,
    FacultyApproveSerializer,
    FacultyRejectSerializer,
    StudentListSerializer,
)


# ── Auth ───────────────────────────────────────────────────────────────────────

class StudentRegisterView(generics.CreateAPIView):
    permission_classes = [AllowAny]
    serializer_class   = StudentRegisterSerializer
    throttle_scope     = "register"

    def create(self, request, *args, **kwargs):
        ser = self.get_serializer(data=request.data)
        ser.is_valid(raise_exception=True)
        user = ser.save()
        return Response(
            {"detail": "Student registered successfully.", "email": user.email},
            status=status.HTTP_201_CREATED,
        )


class FacultyRegisterView(generics.CreateAPIView):
    permission_classes = [AllowAny]
    serializer_class   = FacultyRegisterSerializer
    throttle_scope     = "register"

    def create(self, request, *args, **kwargs):
        ser = self.get_serializer(data=request.data)
        ser.is_valid(raise_exception=True)
        user = ser.save()
        return Response(
            {
                "detail": "Faculty registered. Awaiting HOD approval before you can access faculty features.",
                "email": user.email,
            },
            status=status.HTTP_201_CREATED,
        )


class CustomTokenObtainPairView(TokenObtainPairView):
    serializer_class = CustomTokenObtainPairSerializer
    throttle_scope   = "login"


class LogoutView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        try:
            token = RefreshToken(request.data.get("refresh"))
            token.blacklist()
        except (TokenError, Exception):
            pass  # Already blacklisted or invalid — still 200
        return Response({"detail": "Logged out."})


class MeView(generics.RetrieveUpdateAPIView):
    permission_classes = [IsAuthenticated]
    serializer_class   = MeSerializer

    def get_object(self):
        return self.request.user


# ── HOD: Faculty management ────────────────────────────────────────────────────

class HODFacultyListView(generics.ListAPIView):
    permission_classes = [IsHOD]
    serializer_class   = FacultyListSerializer

    def get_queryset(self):
        qs = Faculty.objects.select_related("user", "department")
        status_filter = self.request.query_params.get("status")
        if status_filter == "pending":
            qs = qs.filter(approval_status=ApprovalStatus.PENDING)
        elif status_filter == "active":
            qs = qs.filter(approval_status=ApprovalStatus.APPROVED, account_status=AccountStatus.ACTIVE)
        elif status_filter == "rejected":
            qs = qs.filter(approval_status=ApprovalStatus.REJECTED)
        return qs


class HODFacultyDetailView(generics.RetrieveUpdateAPIView):
    permission_classes = [IsHOD]
    serializer_class   = FacultyListSerializer
    queryset           = Faculty.objects.select_related("user", "department")


class HODFacultyApproveView(APIView):
    permission_classes = [IsHOD]

    def post(self, request, pk):
        try:
            faculty = Faculty.objects.select_related("user").get(pk=pk)
        except Faculty.DoesNotExist:
            return Response({"detail": "Not found."}, status=404)

        faculty.approval_status = ApprovalStatus.APPROVED
        faculty.account_status  = AccountStatus.ACTIVE
        faculty.save()
        log_action(request.user, "APPROVE_FACULTY", "accounts.Faculty", faculty.pk,
                   {"name": faculty.name})
        return Response({"detail": f"{faculty.name} approved and activated."})


class HODFacultyRejectView(APIView):
    permission_classes = [IsHOD]

    def post(self, request, pk):
        ser = FacultyRejectSerializer(data=request.data)
        ser.is_valid(raise_exception=True)
        try:
            faculty = Faculty.objects.select_related("user").get(pk=pk)
        except Faculty.DoesNotExist:
            return Response({"detail": "Not found."}, status=404)

        faculty.approval_status = ApprovalStatus.REJECTED
        faculty.account_status  = AccountStatus.INACTIVE
        faculty.save()
        log_action(request.user, "REJECT_FACULTY", "accounts.Faculty", faculty.pk,
                   {"name": faculty.name, "reason": ser.validated_data["reason"]})
        return Response({"detail": f"{faculty.name} rejected."})


class HODFacultyActivateView(APIView):
    permission_classes = [IsHOD]

    def post(self, request, pk):
        try:
            faculty = Faculty.objects.get(pk=pk)
        except Faculty.DoesNotExist:
            return Response({"detail": "Not found."}, status=404)
        if faculty.approval_status != ApprovalStatus.APPROVED:
            return Response({"detail": "Faculty must be approved first."}, status=400)
        faculty.account_status = AccountStatus.ACTIVE
        faculty.save()
        log_action(request.user, "ACTIVATE_FACULTY", "accounts.Faculty", faculty.pk, {})
        return Response({"detail": "Faculty activated."})


class HODFacultyDeactivateView(APIView):
    permission_classes = [IsHOD]

    def post(self, request, pk):
        try:
            faculty = Faculty.objects.get(pk=pk)
        except Faculty.DoesNotExist:
            return Response({"detail": "Not found."}, status=404)
        faculty.account_status = AccountStatus.INACTIVE
        faculty.save()
        log_action(request.user, "DEACTIVATE_FACULTY", "accounts.Faculty", faculty.pk, {})
        return Response({"detail": "Faculty deactivated."})


# ── HOD: Student management ────────────────────────────────────────────────────

class HODStudentListView(generics.ListAPIView):
    permission_classes = [IsHOD]
    serializer_class   = StudentListSerializer

    def get_queryset(self):
        qs = Student.objects.select_related("user", "department")
        q  = self.request.query_params
        if q.get("roll_no"):
            qs = qs.filter(roll_no__icontains=q["roll_no"])
        if q.get("name"):
            qs = qs.filter(name__icontains=q["name"])
        if q.get("department"):
            qs = qs.filter(department__code=q["department"])
        if q.get("year"):
            qs = qs.filter(year=q["year"])
        if q.get("status"):
            qs = qs.filter(status=q["status"])
        return qs


class HODStudentDetailView(generics.RetrieveUpdateAPIView):
    permission_classes = [IsHOD]
    serializer_class   = StudentListSerializer
    queryset           = Student.objects.select_related("user", "department")

    def perform_update(self, serializer):
        serializer.save()
        log_action(self.request.user, "EDIT_STUDENT", "accounts.Student",
                   serializer.instance.pk, {})


class HODStudentSetStatusView(APIView):
    permission_classes = [IsHOD]

    def post(self, request, pk):
        new_status = request.data.get("status")
        valid = [UserStatus.ACTIVE, UserStatus.INACTIVE, UserStatus.SUSPENDED]
        if new_status not in valid:
            return Response({"detail": f"status must be one of {valid}"}, status=400)
        try:
            student = Student.objects.select_related("user").get(pk=pk)
        except Student.DoesNotExist:
            return Response({"detail": "Not found."}, status=404)
        student.user.status = new_status
        student.user.save()
        log_action(request.user, "SET_STUDENT_STATUS", "accounts.Student", pk,
                   {"status": new_status})
        return Response({"detail": f"Student account status set to {new_status}."})
