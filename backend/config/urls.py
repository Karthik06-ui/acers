"""Root URL configuration for SEAP-CES."""
from django.contrib import admin
from django.urls import path, include
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import AllowAny
from rest_framework.response import Response

from enrollments.views import StudentAcademicRecordView, StudentDashboardView
from config.docs import schema_view, SwaggerUIView


@api_view(["GET"])
@permission_classes([AllowAny])
def health_check(request):
    return Response({"status": "ok"})


urlpatterns = [
    path("admin/", admin.site.urls),
    path("api/health/", health_check, name="health-check"),

    # API Documentation & Schema
    path("api/schema/", schema_view, name="openapi-schema"),
    path("api/docs/", SwaggerUIView.as_view(), name="api-docs"),

    # Core modules
    path("api/auth/", include("accounts.urls", namespace="accounts")),
    path("api/academics/", include("academics.urls", namespace="academics")),
    path("api/enrollments/", include("enrollments.urls", namespace="enrollments")),

    # Direct student academic record & dashboard routes
    path("api/academic-record/", StudentAcademicRecordView.as_view(), name="student-academic-record"),
    path("api/student/dashboard/", StudentDashboardView.as_view(), name="student-dashboard"),

    # Role-based endpoints
    path("api/faculty/", include("enrollments.faculty_urls", namespace="faculty")),
    path("api/hod/", include("enrollments.hod_urls", namespace="hod")),

    # Notifications
    path("api/notifications/", include("notifications.urls", namespace="notifications")),
]
