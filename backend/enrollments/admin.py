"""enrollments/admin.py — admin for EnrollmentRequest, Enrollment, AcademicRecord."""
from django.contrib import admin
from .models import EnrollmentRequest, Enrollment, AcademicRecord


@admin.register(EnrollmentRequest)
class EnrollmentRequestAdmin(admin.ModelAdmin):
    list_display  = ["id", "student", "offering", "status",
                      "request_date", "reviewed_by", "reviewed_date"]
    list_filter   = ["status", "offering__semester", "offering__course__department"]
    search_fields = ["student__name", "student__roll_no",
                      "offering__course__code", "offering__course__name"]
    readonly_fields = ["created_at", "updated_at"]
    raw_id_fields   = ["student", "offering", "reviewed_by"]
    list_select_related = ["student", "offering__course", "offering__semester", "reviewed_by"]
    date_hierarchy  = "request_date"
    fieldsets = (
        ("Request",   {"fields": ("student", "offering", "request_date", "status")}),
        ("Review",    {"fields": ("reviewed_by", "reviewed_date", "remarks")}),
        ("Timestamps",{"fields": ("created_at", "updated_at")}),
    )


@admin.register(Enrollment)
class EnrollmentAdmin(admin.ModelAdmin):
    list_display  = ["id", "student", "offering", "status",
                      "enrollment_date", "grade_points"]
    list_filter   = ["status", "offering__semester", "offering__course__department"]
    search_fields = ["student__name", "student__roll_no",
                      "offering__course__code"]
    readonly_fields = ["created_at", "updated_at"]
    raw_id_fields   = ["student", "offering", "request"]
    list_select_related = ["student", "offering__course", "offering__semester"]
    date_hierarchy  = "enrollment_date"
    fieldsets = (
        ("Enrollment", {"fields": ("student", "offering", "request", "status")}),
        ("Dates",      {"fields": ("enrollment_date", "approved_date", "withdrawal_date")}),
        ("Grade",      {"fields": ("grade_points", "remarks")}),
        ("Timestamps", {"fields": ("created_at", "updated_at")}),
    )


@admin.register(AcademicRecord)
class AcademicRecordAdmin(admin.ModelAdmin):
    list_display  = ["student", "semester", "semester_gpa",
                      "credits_registered", "credits_earned", "cumulative_cgpa"]
    list_filter   = ["semester"]
    search_fields = ["student__name", "student__roll_no"]
    readonly_fields = ["created_at", "updated_at"]
    raw_id_fields   = ["student", "semester"]
    list_select_related = ["student", "semester"]
