"""academics/urls.py"""
from django.urls import path
from . import views

app_name = "academics"

urlpatterns = [
    path("departments/",        views.DepartmentListCreateView.as_view(),  name="department-list"),
    path("departments/<int:pk>/", views.DepartmentDetailView.as_view(),    name="department-detail"),

    path("semesters/",          views.SemesterListCreateView.as_view(),    name="semester-list"),
    path("semesters/<int:pk>/", views.SemesterDetailView.as_view(),        name="semester-detail"),

    path("courses/",            views.CourseListCreateView.as_view(),      name="course-list"),
    path("courses/<int:pk>/",   views.CourseDetailView.as_view(),          name="course-detail"),

    path("offerings/",          views.CourseOfferingListCreateView.as_view(), name="offering-list"),
    path("offerings/<int:pk>/", views.CourseOfferingDetailView.as_view(),     name="offering-detail"),
]
