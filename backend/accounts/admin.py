"""accounts/admin.py — admin registrations for User, Student, Faculty, HOD."""
from django.contrib import admin
from django.contrib.auth.admin import UserAdmin as DjangoUserAdmin
from .models import User, Student, Faculty, HOD


# ── User ──────────────────────────────────────────────────────────────────────

@admin.register(User)
class UserAdmin(DjangoUserAdmin):
    ordering     = ["-created_at"]
    list_display = ["email", "role", "status", "is_active", "is_staff", "created_at"]
    list_filter  = ["role", "status", "is_active", "is_staff"]
    search_fields = ["email"]
    readonly_fields = ["created_at", "updated_at"]
    fieldsets = (
        (None,             {"fields": ("email", "password")}),
        ("Role & Status",  {"fields": ("role", "status")}),
        ("Permissions",    {"fields": ("is_active", "is_staff", "is_superuser",
                                       "groups", "user_permissions")}),
        ("Timestamps",     {"fields": ("created_at", "updated_at")}),
    )
    add_fieldsets = (
        (None, {
            "classes": ("wide",),
            "fields":  ("email", "role", "password1", "password2"),
        }),
    )


# ── Student ───────────────────────────────────────────────────────────────────

@admin.register(Student)
class StudentAdmin(admin.ModelAdmin):
    list_display   = ["name", "roll_no", "department", "year", "cgpa", "status"]
    list_filter    = ["status", "year", "department"]
    search_fields  = ["name", "roll_no", "user__email"]
    readonly_fields = ["created_at", "updated_at"]
    raw_id_fields  = ["user", "department"]
    list_select_related = ["user", "department"]
    fieldsets = (
        ("Identity",    {"fields": ("user", "name", "roll_no")}),
        ("Academic",    {"fields": ("department", "year", "cgpa")}),
        ("Contact",     {"fields": ("phone",)}),
        ("Status",      {"fields": ("status",)}),
        ("Timestamps",  {"fields": ("created_at", "updated_at")}),
    )


# ── Faculty ───────────────────────────────────────────────────────────────────

@admin.register(Faculty)
class FacultyAdmin(admin.ModelAdmin):
    list_display   = ["name", "designation", "department",
                       "approval_status", "account_status"]
    list_filter    = ["approval_status", "account_status", "designation", "department"]
    search_fields  = ["name", "user__email"]
    readonly_fields = ["created_at", "updated_at"]
    raw_id_fields  = ["user", "department"]
    list_select_related = ["user", "department"]
    actions = ["approve_faculty", "reject_faculty"]
    fieldsets = (
        ("Identity",     {"fields": ("user", "name", "designation")}),
        ("Department",   {"fields": ("department",)}),
        ("Contact",      {"fields": ("phone",)}),
        ("Approval",     {"fields": ("approval_status", "account_status")}),
        ("Timestamps",   {"fields": ("created_at", "updated_at")}),
    )

    @admin.action(description="Approve selected faculty")
    def approve_faculty(self, request, queryset):
        queryset.update(approval_status="Approved", account_status="Active")

    @admin.action(description="Reject selected faculty")
    def reject_faculty(self, request, queryset):
        queryset.update(approval_status="Rejected", account_status="Inactive")


# ── HOD ───────────────────────────────────────────────────────────────────────

@admin.register(HOD)
class HODAdmin(admin.ModelAdmin):
    list_display   = ["name", "department", "status"]
    list_filter    = ["status", "department"]
    search_fields  = ["name", "user__email"]
    readonly_fields = ["created_at", "updated_at"]
    raw_id_fields  = ["user", "department"]
    list_select_related = ["user", "department"]
    fieldsets = (
        ("Identity",    {"fields": ("user", "name")}),
        ("Department",  {"fields": ("department",)}),
        ("Contact",     {"fields": ("phone",)}),
        ("Status",      {"fields": ("status",)}),
        ("Timestamps",  {"fields": ("created_at", "updated_at")}),
    )
