"""enrollments/hod_urls.py"""
from django.urls import path
from . import views
from reports.views import HODReportsView
from audit.views import AuditLogListView

app_name = "hod"

urlpatterns = [
    path("enrollments/", views.HODEnrollmentsListView.as_view(), name="enrollments-list"),
    path("requests/", views.HODRequestsListView.as_view(), name="requests-list"),
    path("override/", views.HODOverrideView.as_view(), name="override"),
    path("academic-records/<int:student_id>/", views.HODStudentAcademicRecordView.as_view(), name="academic-records"),
    path("dashboard/", views.HODDashboardView.as_view(), name="dashboard"),
    path("reports/", HODReportsView.as_view(), name="reports"),
    path("audit-logs/", AuditLogListView.as_view(), name="audit-logs"),
]
