"""accounts/permissions.py — DRF permission classes."""
from rest_framework.permissions import BasePermission, SAFE_METHODS
from .models import UserRole


class IsHOD(BasePermission):
    message = "Only the HOD can perform this action."

    def has_permission(self, request, view):
        return bool(
            request.user and request.user.is_authenticated
            and request.user.role == UserRole.HOD
        )


class IsApprovedFaculty(BasePermission):
    """Approved AND Active faculty only."""
    message = "Only approved and active Faculty can perform this action."

    def has_permission(self, request, view):
        if not (request.user and request.user.is_authenticated):
            return False
        if request.user.role != UserRole.FACULTY:
            return False
        try:
            f = request.user.faculty_profile
            return f.approval_status == "Approved" and f.account_status == "Active"
        except Exception:
            return False


class IsStudent(BasePermission):
    message = "Only students can perform this action."

    def has_permission(self, request, view):
        return bool(
            request.user and request.user.is_authenticated
            and request.user.role == UserRole.STUDENT
        )


class IsHODOrApprovedFaculty(BasePermission):
    """HOD, or approved+active Faculty."""
    message = "Only HOD or approved Faculty can perform this action."

    def has_permission(self, request, view):
        u = request.user
        if not (u and u.is_authenticated):
            return False
        if u.role == UserRole.HOD:
            return True
        if u.role == UserRole.FACULTY:
            try:
                f = u.faculty_profile
                return f.approval_status == "Approved" and f.account_status == "Active"
            except Exception:
                return False
        return False


class IsOwnerOrHOD(BasePermission):
    """Object-level: owner (request.user == obj.user) or HOD."""
    message = "You do not have permission to access this resource."

    def has_object_permission(self, request, view, obj):
        if request.user.role == UserRole.HOD:
            return True
        # obj can be a profile (Student/Faculty/HOD) or a User directly
        owner = getattr(obj, "user", obj)
        return owner == request.user
