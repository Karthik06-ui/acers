"""
enrollments/serializers.py
Serializers for enrollment requests, enrollments, and academic records.
"""
from decimal import Decimal
from rest_framework import serializers
from academics.models import CourseOffering
from accounts.models import Student
from .models import EnrollmentRequest, Enrollment, AcademicRecord


class StudentSummarySerializer(serializers.ModelSerializer):
    email = serializers.EmailField(source="user.email", read_only=True)
    department_name = serializers.CharField(source="department.name", read_only=True, default=None)
    department_code = serializers.CharField(source="department.code", read_only=True, default=None)

    class Meta:
        model = Student
        fields = [
            "id",
            "name",
            "roll_no",
            "email",
            "year",
            "cgpa",
            "status",
            "department",
            "department_name",
            "department_code",
        ]


class OfferingSummarySerializer(serializers.ModelSerializer):
    course_code = serializers.CharField(source="course.code", read_only=True)
    course_name = serializers.CharField(source="course.name", read_only=True)
    credits = serializers.IntegerField(source="course.credits", read_only=True)
    faculty_name = serializers.CharField(source="faculty.name", read_only=True)
    semester_name = serializers.CharField(source="semester.semester_name", read_only=True)
    academic_year = serializers.CharField(source="semester.academic_year", read_only=True)

    class Meta:
        model = CourseOffering
        fields = [
            "id",
            "course",
            "course_code",
            "course_name",
            "credits",
            "faculty",
            "faculty_name",
            "semester",
            "semester_name",
            "academic_year",
            "capacity",
            "status",
            "active_enrollment_count",
            "seats_available",
        ]


class EnrollmentRequestSerializer(serializers.ModelSerializer):
    student = StudentSummarySerializer(read_only=True)
    offering = OfferingSummarySerializer(read_only=True)
    reviewed_by_email = serializers.EmailField(source="reviewed_by.email", read_only=True, default=None)

    class Meta:
        model = EnrollmentRequest
        fields = [
            "id",
            "student",
            "offering",
            "request_date",
            "status",
            "reviewed_by",
            "reviewed_by_email",
            "reviewed_date",
            "remarks",
            "created_at",
            "updated_at",
        ]


class EnrollmentRequestCreateSerializer(serializers.Serializer):
    offering = serializers.PrimaryKeyRelatedField(queryset=CourseOffering.objects.all())


class EnrollmentSerializer(serializers.ModelSerializer):
    student = StudentSummarySerializer(read_only=True)
    offering = OfferingSummarySerializer(read_only=True)

    class Meta:
        model = Enrollment
        fields = [
            "id",
            "student",
            "offering",
            "request",
            "enrollment_date",
            "approved_date",
            "withdrawal_date",
            "status",
            "grade_points",
            "remarks",
            "created_at",
            "updated_at",
        ]


class AcademicRecordSerializer(serializers.ModelSerializer):
    student_name = serializers.CharField(source="student.name", read_only=True)
    student_roll_no = serializers.CharField(source="student.roll_no", read_only=True)
    semester_name = serializers.CharField(source="semester.semester_name", read_only=True)
    academic_year = serializers.CharField(source="semester.academic_year", read_only=True)

    class Meta:
        model = AcademicRecord
        fields = [
            "id",
            "student",
            "student_name",
            "student_roll_no",
            "semester",
            "semester_name",
            "academic_year",
            "semester_gpa",
            "credits_registered",
            "credits_earned",
            "cumulative_cgpa",
            "created_at",
            "updated_at",
        ]


class AcademicRecordUpdateSerializer(serializers.ModelSerializer):
    class Meta:
        model = AcademicRecord
        fields = ["semester_gpa", "credits_registered", "credits_earned", "cumulative_cgpa"]


class ApproveRequestSerializer(serializers.Serializer):
    remarks = serializers.CharField(required=False, allow_blank=True, default="")


class RejectRequestSerializer(serializers.Serializer):
    remarks = serializers.CharField(required=True, allow_blank=False)


class CompleteEnrollmentSerializer(serializers.Serializer):
    grade_points = serializers.DecimalField(max_digits=4, decimal_places=2, min_value=Decimal("0"), max_value=Decimal("10"))


class HODOverrideSerializer(serializers.Serializer):
    target_id = serializers.IntegerField(required=True)
    target_type = serializers.ChoiceField(choices=["request", "enrollment"], required=True)
    action = serializers.ChoiceField(choices=["approve", "reject", "withdraw"], required=True)
    reason = serializers.CharField(required=True, allow_blank=False)
