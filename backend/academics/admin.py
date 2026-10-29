"""academics/admin.py — admin for Department, Semester, Course, CourseOffering."""
from django.contrib import admin
from .models import Department, Semester, Course, CourseOffering


@admin.register(Department)
class DepartmentAdmin(admin.ModelAdmin):
    list_display  = ["code", "name", "status"]
    list_filter   = ["status"]
    search_fields = ["name", "code"]
    readonly_fields = ["created_at", "updated_at"]


@admin.register(Semester)
class SemesterAdmin(admin.ModelAdmin):
    list_display  = ["academic_year", "semester_name", "start_date", "end_date", "status"]
    list_filter   = ["status", "semester_name"]
    search_fields = ["academic_year"]
    readonly_fields = ["created_at", "updated_at"]


class CourseOfferingInline(admin.TabularInline):
    model  = CourseOffering
    extra  = 0
    fields = ["faculty", "semester", "capacity", "status"]
    raw_id_fields = ["faculty", "semester"]
    show_change_link = True


@admin.register(Course)
class CourseAdmin(admin.ModelAdmin):
    list_display  = ["code", "name", "department", "credits",
                      "course_type", "capacity", "minimum_cgpa", "status"]
    list_filter   = ["status", "course_type", "department"]
    search_fields = ["code", "name"]
    readonly_fields = ["created_at", "updated_at"]
    list_select_related = ["department"]
    inlines = [CourseOfferingInline]
    fieldsets = (
        ("Identification", {"fields": ("code", "name", "department")}),
        ("Details",        {"fields": ("credits", "course_type", "capacity",
                                       "minimum_cgpa", "description")}),
        ("Status",         {"fields": ("status",)}),
        ("Timestamps",     {"fields": ("created_at", "updated_at")}),
    )


@admin.register(CourseOffering)
class CourseOfferingAdmin(admin.ModelAdmin):
    list_display  = ["course", "faculty", "semester", "capacity",
                      "active_enrollment_count", "seats_available", "status"]
    list_filter   = ["status", "semester", "faculty__department"]
    search_fields = ["course__code", "course__name", "faculty__name"]
    readonly_fields = ["created_at", "updated_at", "active_enrollment_count", "seats_available"]
    raw_id_fields = ["course", "faculty", "semester"]
    list_select_related = ["course", "faculty", "semester"]

    @admin.display(description="Active Enrollments")
    def active_enrollment_count(self, obj):
        return obj.active_enrollment_count

    @admin.display(description="Seats Available")
    def seats_available(self, obj):
        return obj.seats_available
