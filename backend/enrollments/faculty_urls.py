"""enrollments/faculty_urls.py"""
from django.urls import path
from . import views

app_name = "faculty"

urlpatterns = [
    path("requests/", views.FacultyRequestsListView.as_view(), name="request-list"),
    path("requests/<int:pk>/", views.FacultyRequestDetailView.as_view(), name="request-detail"),
    path("requests/<int:pk>/approve/", views.FacultyRequestApproveView.as_view(), name="request-approve"),
    path("requests/<int:pk>/reject/", views.FacultyRequestRejectView.as_view(), name="request-reject"),
    path("offerings/<int:pk>/students/", views.FacultyOfferingStudentsView.as_view(), name="offering-students"),
    path("enrollments/<int:pk>/complete/", views.FacultyEnrollmentCompleteView.as_view(), name="enrollment-complete"),
    path("dashboard/", views.FacultyDashboardView.as_view(), name="dashboard"),
]
