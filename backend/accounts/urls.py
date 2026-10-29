"""accounts/urls.py"""
from django.urls import path
from rest_framework_simplejwt.views import TokenRefreshView

from . import views

app_name = "accounts"

urlpatterns = [
    # Auth
    path("register/student/",  views.StudentRegisterView.as_view(),       name="register-student"),
    path("register/faculty/",  views.FacultyRegisterView.as_view(),       name="register-faculty"),
    path("login/",             views.CustomTokenObtainPairView.as_view(), name="login"),
    path("refresh/",           TokenRefreshView.as_view(),                name="token-refresh"),
    path("logout/",            views.LogoutView.as_view(),                name="logout"),
    path("me/",                views.MeView.as_view(),                    name="me"),

    # HOD — Faculty management
    path("hod/faculty/",                    views.HODFacultyListView.as_view(),       name="hod-faculty-list"),
    path("hod/faculty/<int:pk>/",           views.HODFacultyDetailView.as_view(),     name="hod-faculty-detail"),
    path("hod/faculty/<int:pk>/approve/",   views.HODFacultyApproveView.as_view(),   name="hod-faculty-approve"),
    path("hod/faculty/<int:pk>/reject/",    views.HODFacultyRejectView.as_view(),    name="hod-faculty-reject"),
    path("hod/faculty/<int:pk>/activate/",  views.HODFacultyActivateView.as_view(),  name="hod-faculty-activate"),
    path("hod/faculty/<int:pk>/deactivate/",views.HODFacultyDeactivateView.as_view(),name="hod-faculty-deactivate"),

    # HOD — Student management
    path("hod/students/",                   views.HODStudentListView.as_view(),       name="hod-student-list"),
    path("hod/students/<int:pk>/",          views.HODStudentDetailView.as_view(),     name="hod-student-detail"),
    path("hod/students/<int:pk>/status/",   views.HODStudentSetStatusView.as_view(), name="hod-student-status"),
]
