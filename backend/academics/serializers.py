"""academics/serializers.py"""
from rest_framework import serializers
from .models import Department, Semester, Course, CourseOffering


class DepartmentSerializer(serializers.ModelSerializer):
    class Meta:
        model  = Department
        fields = ["id", "name", "code", "status", "created_at"]
        read_only_fields = ["id", "created_at"]


class SemesterSerializer(serializers.ModelSerializer):
    class Meta:
        model  = Semester
        fields = ["id", "academic_year", "semester_name", "start_date", "end_date",
                  "status", "created_at"]
        read_only_fields = ["id", "created_at"]


class CourseOfferingBriefSerializer(serializers.ModelSerializer):
    faculty_name = serializers.CharField(source="faculty.name", read_only=True)
    semester_str = serializers.SerializerMethodField()
    seats_available = serializers.IntegerField(read_only=True)

    class Meta:
        model  = CourseOffering
        fields = ["id", "faculty", "faculty_name", "semester", "semester_str",
                  "capacity", "seats_available", "status"]
        read_only_fields = ["id", "faculty_name", "semester_str", "seats_available"]

    def get_semester_str(self, obj):
        return str(obj.semester)


class CourseSerializer(serializers.ModelSerializer):
    department_name  = serializers.CharField(source="department.name", read_only=True)
    seats_taken      = serializers.SerializerMethodField()
    seats_available  = serializers.SerializerMethodField()
    is_available     = serializers.SerializerMethodField()
    eligible         = serializers.SerializerMethodField()
    ineligible_reason = serializers.SerializerMethodField()
    offerings        = CourseOfferingBriefSerializer(many=True, read_only=True)

    class Meta:
        model  = Course
        fields = [
            "id", "code", "name", "department", "department_name",
            "credits", "course_type", "capacity", "minimum_cgpa",
            "description", "status",
            "seats_taken", "seats_available", "is_available",
            "eligible", "ineligible_reason",
            "offerings",
        ]
        read_only_fields = ["id", "department_name", "seats_taken", "seats_available",
                            "is_available", "eligible", "ineligible_reason", "offerings"]

    def _open_offerings(self, obj):
        return [o for o in obj.offerings.all() if o.status == "Open"]

    def get_seats_taken(self, obj):
        return sum(o.active_enrollment_count for o in obj.offerings.all())

    def get_seats_available(self, obj):
        return sum(o.seats_available for o in self._open_offerings(obj))

    def get_is_available(self, obj):
        return obj.status == "Open" and any(o.seats_available > 0 for o in self._open_offerings(obj))

    def get_eligible(self, obj):
        request = self.context.get("request")
        if not request or request.user.role != "STUDENT":
            return None
        try:
            cgpa = request.user.student_profile.cgpa
        except Exception:
            return None
        if obj.minimum_cgpa and cgpa < obj.minimum_cgpa:
            return False
        return self.get_is_available(obj)

    def get_ineligible_reason(self, obj):
        request = self.context.get("request")
        if not request or request.user.role != "STUDENT":
            return None
        try:
            cgpa = request.user.student_profile.cgpa
        except Exception:
            return None
        if obj.minimum_cgpa and cgpa < obj.minimum_cgpa:
            return f"Minimum CGPA {obj.minimum_cgpa} required (yours: {cgpa})."
        if not self.get_is_available(obj):
            return "No seats available."
        return None


class CourseWriteSerializer(serializers.ModelSerializer):
    class Meta:
        model  = Course
        fields = ["code", "name", "department", "credits", "course_type",
                  "capacity", "minimum_cgpa", "description", "status"]


class CourseOfferingSerializer(serializers.ModelSerializer):
    faculty_name = serializers.CharField(source="faculty.name", read_only=True)
    course_code  = serializers.CharField(source="course.code", read_only=True)
    course_name  = serializers.CharField(source="course.name", read_only=True)
    semester_str = serializers.SerializerMethodField()
    seats_available = serializers.IntegerField(read_only=True)

    class Meta:
        model  = CourseOffering
        fields = [
            "id", "course", "course_code", "course_name",
            "faculty", "faculty_name",
            "semester", "semester_str",
            "capacity", "seats_available", "status",
        ]
        read_only_fields = ["id", "faculty_name", "course_code", "course_name",
                            "semester_str", "seats_available"]

    def get_semester_str(self, obj):
        return str(obj.semester)

    def validate(self, attrs):
        course   = attrs.get("course",   getattr(self.instance, "course",   None))
        faculty  = attrs.get("faculty",  getattr(self.instance, "faculty",  None))
        semester = attrs.get("semester", getattr(self.instance, "semester", None))
        if course and faculty and semester:
            qs = CourseOffering.objects.filter(
                course=course, faculty=faculty, semester=semester
            )
            if self.instance:
                qs = qs.exclude(pk=self.instance.pk)
            if qs.exists():
                raise serializers.ValidationError(
                    "This faculty already has an offering for this course in this semester."
                )
        return attrs

    def create(self, validated_data):
        # Default capacity from course if not provided
        if "capacity" not in validated_data:
            validated_data["capacity"] = validated_data["course"].capacity
        return super().create(validated_data)
