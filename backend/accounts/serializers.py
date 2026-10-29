"""accounts/serializers.py"""
from django.contrib.auth.password_validation import validate_password
from rest_framework import serializers
from rest_framework_simplejwt.serializers import TokenObtainPairSerializer

from .models import User, Student, Faculty, HOD, UserRole, UserStatus, ApprovalStatus, AccountStatus


# ── Token ──────────────────────────────────────────────────────────────────────

class CustomTokenObtainPairSerializer(TokenObtainPairSerializer):
    """Adds role, name, status to the token response."""

    def validate(self, attrs):
        email = attrs.get("email") or attrs.get(self.username_field, "")
        # Pre-check: find user to give meaningful errors before JWT validates
        try:
            user = User.objects.get(email=email)
        except User.DoesNotExist:
            raise serializers.ValidationError({"detail": "No account with this email."})

        if user.status == UserStatus.INACTIVE:
            raise serializers.ValidationError({"detail": "Account is deactivated. Contact the HOD."})
        if user.status == UserStatus.SUSPENDED:
            raise serializers.ValidationError({"detail": "Account is suspended. Contact the HOD."})
        if user.role == UserRole.FACULTY:
            try:
                f = user.faculty_profile
                if f.approval_status == ApprovalStatus.REJECTED:
                    raise serializers.ValidationError({"detail": "Your faculty application was rejected."})
            except Faculty.DoesNotExist:
                pass

        data = super().validate(attrs)

        # Attach profile info
        name = ""
        pending_approval = False
        if user.role == UserRole.STUDENT:
            try:
                name = user.student_profile.name
            except Exception:
                pass
        elif user.role == UserRole.FACULTY:
            try:
                f = user.faculty_profile
                name = f.name
                if f.approval_status == ApprovalStatus.PENDING:
                    pending_approval = True
            except Exception:
                pass
        elif user.role == UserRole.HOD:
            try:
                name = user.hod_profile.name
            except Exception:
                pass

        data["role"] = user.role
        data["name"] = name
        data["status"] = user.status
        data["pending_approval"] = pending_approval
        return data


# ── Register ───────────────────────────────────────────────────────────────────

class StudentRegisterSerializer(serializers.ModelSerializer):
    password  = serializers.CharField(write_only=True, validators=[validate_password])
    name      = serializers.CharField(max_length=150)
    roll_no   = serializers.CharField(max_length=30)
    phone     = serializers.CharField(max_length=15, required=False, allow_blank=True)

    class Meta:
        model  = User
        fields = ["email", "password", "name", "roll_no", "phone"]

    def validate_roll_no(self, value):
        if Student.objects.filter(roll_no=value).exists():
            raise serializers.ValidationError("Roll number already registered.")
        return value

    def create(self, validated_data):
        name    = validated_data.pop("name")
        roll_no = validated_data.pop("roll_no")
        phone   = validated_data.pop("phone", "")
        user = User.objects.create_user(
            email=validated_data["email"],
            password=validated_data["password"],
            role=UserRole.STUDENT,
            status=UserStatus.ACTIVE,
        )
        Student.objects.create(user=user, name=name, roll_no=roll_no, phone=phone)
        return user


class FacultyRegisterSerializer(serializers.ModelSerializer):
    password    = serializers.CharField(write_only=True, validators=[validate_password])
    name        = serializers.CharField(max_length=150)
    phone       = serializers.CharField(max_length=15, required=False, allow_blank=True)
    designation = serializers.ChoiceField(
        choices=Faculty.Designation.choices,
        default=Faculty.Designation.ASSISTANT_PROFESSOR,
    )

    class Meta:
        model  = User
        fields = ["email", "password", "name", "phone", "designation"]

    def create(self, validated_data):
        name        = validated_data.pop("name")
        phone       = validated_data.pop("phone", "")
        designation = validated_data.pop("designation", Faculty.Designation.ASSISTANT_PROFESSOR)
        user = User.objects.create_user(
            email=validated_data["email"],
            password=validated_data["password"],
            role=UserRole.FACULTY,
            status=UserStatus.ACTIVE,
        )
        Faculty.objects.create(
            user=user, name=name, phone=phone, designation=designation,
            approval_status=ApprovalStatus.PENDING,
            account_status=AccountStatus.PENDING,
        )
        return user


# ── Me (profile read/update) ────────────────────────────────────────────────

class StudentProfileSerializer(serializers.ModelSerializer):
    class Meta:
        model  = Student
        fields = ["name", "roll_no", "phone", "year", "cgpa", "status", "department"]
        read_only_fields = ["roll_no", "year", "cgpa", "status", "department"]


class FacultyProfileSerializer(serializers.ModelSerializer):
    class Meta:
        model  = Faculty
        fields = ["name", "phone", "designation", "approval_status", "account_status", "department"]
        read_only_fields = ["approval_status", "account_status", "department"]


class HODProfileSerializer(serializers.ModelSerializer):
    class Meta:
        model  = HOD
        fields = ["name", "phone", "department", "status"]
        read_only_fields = ["department", "status"]


class MeSerializer(serializers.ModelSerializer):
    """Read/update current user. Profile is nested read-only."""
    profile         = serializers.SerializerMethodField()
    old_password    = serializers.CharField(write_only=True, required=False)
    new_password    = serializers.CharField(write_only=True, required=False,
                                            validators=[validate_password])

    class Meta:
        model  = User
        fields = ["id", "email", "role", "status", "profile", "old_password", "new_password"]
        read_only_fields = ["id", "email", "role", "status"]

    def get_profile(self, obj):
        if obj.role == UserRole.STUDENT:
            try:
                return StudentProfileSerializer(obj.student_profile).data
            except Exception:
                return {}
        if obj.role == UserRole.FACULTY:
            try:
                return FacultyProfileSerializer(obj.faculty_profile).data
            except Exception:
                return {}
        if obj.role == UserRole.HOD:
            try:
                return HODProfileSerializer(obj.hod_profile).data
            except Exception:
                return {}
        return {}

    def validate(self, attrs):
        new_pw = attrs.get("new_password")
        old_pw = attrs.get("old_password")
        if new_pw and not old_pw:
            raise serializers.ValidationError({"old_password": "Required to change password."})
        if new_pw and not self.instance.check_password(old_pw):
            raise serializers.ValidationError({"old_password": "Incorrect password."})
        return attrs

    def update(self, instance, validated_data):
        new_pw = validated_data.pop("new_password", None)
        validated_data.pop("old_password", None)

        # Delegate profile fields to the profile serializer
        role = instance.role
        profile_fields = {}
        if role == UserRole.STUDENT:
            allowed = ["name", "phone"]
        elif role == UserRole.FACULTY:
            allowed = ["name", "phone", "designation"]
        elif role == UserRole.HOD:
            allowed = ["name", "phone"]
        else:
            allowed = []

        for field in allowed:
            if field in validated_data:
                profile_fields[field] = validated_data.pop(field)

        if profile_fields:
            if role == UserRole.STUDENT:
                Student.objects.filter(user=instance).update(**profile_fields)
            elif role == UserRole.FACULTY:
                Faculty.objects.filter(user=instance).update(**profile_fields)
            elif role == UserRole.HOD:
                HOD.objects.filter(user=instance).update(**profile_fields)

        if new_pw:
            instance.set_password(new_pw)
            instance.save()
        return instance


# ── HOD: Faculty management ────────────────────────────────────────────────────

class FacultyListSerializer(serializers.ModelSerializer):
    email          = serializers.EmailField(source="user.email", read_only=True)
    user_status    = serializers.CharField(source="user.status", read_only=True)
    department_name = serializers.CharField(source="department.name", read_only=True, default=None)

    class Meta:
        model  = Faculty
        fields = [
            "id", "name", "email", "phone", "designation",
            "approval_status", "account_status", "user_status",
            "department", "department_name",
        ]
        read_only_fields = ["id", "email", "user_status", "department_name"]


class FacultyApproveSerializer(serializers.Serializer):
    """Used by HOD to approve a faculty member."""
    pass  # no extra fields needed


class FacultyRejectSerializer(serializers.Serializer):
    reason = serializers.CharField(required=True)


# ── HOD: Student management ────────────────────────────────────────────────────

class StudentListSerializer(serializers.ModelSerializer):
    email       = serializers.EmailField(source="user.email", read_only=True)
    user_status = serializers.CharField(source="user.status", read_only=True)
    department_name = serializers.CharField(source="department.name", read_only=True, default=None)

    class Meta:
        model  = Student
        fields = [
            "id", "name", "email", "roll_no", "phone",
            "year", "cgpa", "status", "user_status",
            "department", "department_name",
        ]
        read_only_fields = ["id", "email", "roll_no", "cgpa", "user_status", "department_name"]
