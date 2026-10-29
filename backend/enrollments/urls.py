"""enrollments/urls.py"""
from django.urls import path
from . import views

app_name = "enrollments"

urlpatterns = [
    path("requests/", views.StudentEnrollmentRequestListCreateView.as_view(), name="request-list-create"),
    path("<int:pk>/withdraw/", views.StudentEnrollmentWithdrawView.as_view(), name="enrollment-withdraw"),
    path("my/", views.StudentMyEnrollmentsView.as_view(), name="my-enrollments"),
]
