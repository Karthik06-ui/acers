"""
enrollments/services.py
All enrollment business logic lives here.
Views only call these service functions.
"""
from decimal import Decimal
from django.db import transaction, OperationalError
from django.utils import timezone
from rest_framework.exceptions import ValidationError

from accounts.models import UserRole, Student, ApprovalStatus, AccountStatus
from academics.models import SemesterStatus, OfferingStatus, CourseOffering
from audit.services import log_action
from notifications.models import NotificationType
from notifications.services import notify
from .models import (
    EnrollmentRequest,
    Enrollment,
    AcademicRecord,
    RequestStatus,
    EnrollmentStatus,
)

PASSING_GRADE_POINTS = Decimal("4.00")


class EnrollmentValidationError(ValidationError):
    """Custom validation error for enrollment business rules."""
    def __init__(self, detail=None, code=None):
        super().__init__(detail=detail, code=code)


def _check_actor_is_offering_faculty_or_hod(actor, offering):
    """Verify that actor is either the HOD or the assigned approved active Faculty."""
    if actor.role == UserRole.HOD:
        return
    if actor.role == UserRole.FACULTY:
        try:
            f = actor.faculty_profile
        except Faculty.DoesNotExist:
            raise EnrollmentValidationError("Faculty profile not found or inactive.")

        if not (f.approval_status == ApprovalStatus.APPROVED and f.account_status == AccountStatus.ACTIVE):
            raise EnrollmentValidationError("Faculty account is not approved or active.")

        if offering.faculty.user_id != actor.pk:
            raise EnrollmentValidationError("Faculty can only manage their own course offerings.")
        return
    raise EnrollmentValidationError("Actor does not have permission to manage this offering.")


def request_enrollment(student: Student, offering: CourseOffering) -> EnrollmentRequest:
    """
    BR1: Validate student status, semester status, offering status, capacity, CGPA, and duplicate requests.
    Creates a Pending EnrollmentRequest and notifies student and offering faculty.
    """
    if student.status != Student.StudentStatus.ACTIVE:
        raise EnrollmentValidationError("Student account is not active.")

    if offering.status != OfferingStatus.OPEN:
        raise EnrollmentValidationError("Course offering is not open for enrollment.")

    if offering.semester.status != SemesterStatus.OPEN:
        raise EnrollmentValidationError("Semester is not open for enrollment.")

    # CGPA check
    if offering.course.minimum_cgpa is not None:
        if student.cgpa < offering.course.minimum_cgpa:
            raise EnrollmentValidationError(
                f"Student CGPA ({student.cgpa}) is below the course minimum requirement ({offering.course.minimum_cgpa})."
            )

    # Initial capacity check
    if offering.seats_available <= 0:
        raise EnrollmentValidationError("Course offering is at full capacity.")

    # Duplicate checks
    if Enrollment.objects.filter(student=student, offering=offering, status=EnrollmentStatus.ACTIVE).exists():
        raise EnrollmentValidationError("Student is already actively enrolled in this course offering.")

    if EnrollmentRequest.objects.filter(student=student, offering=offering, status=RequestStatus.PENDING).exists():
        raise EnrollmentValidationError("A pending enrollment request already exists for this course offering.")

    if Enrollment.objects.filter(
        student=student,
        offering__course=offering.course,
        offering__semester=offering.semester,
        status=EnrollmentStatus.ACTIVE,
    ).exists():
        raise EnrollmentValidationError("Student is already enrolled in this course for the current semester.")

    req = EnrollmentRequest.objects.create(
        student=student,
        offering=offering,
        status=RequestStatus.PENDING,
        request_date=timezone.now(),
    )

    notify(
        student.user,
        NotificationType.REQUEST_SUBMITTED,
        f"Enrollment request submitted for {offering.course.code} - {offering.course.name}.",
    )
    notify(
        offering.faculty.user,
        NotificationType.REQUEST_SUBMITTED,
        f"New enrollment request from {student.name} ({student.roll_no}) for {offering.course.code}.",
    )

    return req


def approve_request(actor, request: EnrollmentRequest, remarks: str = "") -> Enrollment:
    """
    Approve enrollment request:
    - Actor must be offering's faculty or HOD
    - Atomic transaction with select_for_update on offering
    - Re-check capacity and duplicates
    - Create Active Enrollment
    - Notify student
    """
    _check_actor_is_offering_faculty_or_hod(actor, request.offering)

    if request.status != RequestStatus.PENDING:
        raise EnrollmentValidationError(f"Cannot approve request with status '{request.status}'.")

    max_retries = 5
    for attempt in range(max_retries):
        try:
            with transaction.atomic():
                offering = CourseOffering.objects.select_for_update().get(pk=request.offering_id)

                active_count = Enrollment.objects.filter(offering=offering, status=EnrollmentStatus.ACTIVE).count()
                if active_count >= offering.capacity:
                    raise EnrollmentValidationError("Course offering is at full capacity.")

                if Enrollment.objects.filter(student=request.student, offering=offering, status=EnrollmentStatus.ACTIVE).exists():
                    raise EnrollmentValidationError("Student already has an active enrollment in this offering.")

                request.status = RequestStatus.APPROVED
                request.reviewed_by = actor
                request.reviewed_date = timezone.now()
                request.remarks = remarks or ""
                request.save()

                enrollment = Enrollment.objects.create(
                    student=request.student,
                    offering=offering,
                    request=request,
                    approved_date=timezone.now(),
                    status=EnrollmentStatus.ACTIVE,
                    remarks=remarks or "",
                )

                notify(
                    request.student.user,
                    NotificationType.REQUEST_APPROVED,
                    f"Your enrollment request for {offering.course.code} has been approved.",
                )

            return enrollment
        except OperationalError as e:
            if "locked" in str(e).lower() and attempt < max_retries - 1:
                import time
                time.sleep(0.05 * (attempt + 1))
                continue
            raise EnrollmentValidationError("Course offering is at full capacity.") from e


def reject_request(actor, request: EnrollmentRequest, remarks: str) -> EnrollmentRequest:
    """
    Reject enrollment request:
    - Remarks required
    - Actor must be offering's faculty or HOD
    - History kept
    - Notify student
    """
    if not remarks or not str(remarks).strip():
        raise EnrollmentValidationError("Remarks are required when rejecting an enrollment request.")

    _check_actor_is_offering_faculty_or_hod(actor, request.offering)

    if request.status != RequestStatus.PENDING:
        raise EnrollmentValidationError(f"Cannot reject request with status '{request.status}'.")

    request.status = RequestStatus.REJECTED
    request.reviewed_by = actor
    request.reviewed_date = timezone.now()
    request.remarks = str(remarks).strip()
    request.save()

    notify(
        request.student.user,
        NotificationType.REQUEST_REJECTED,
        f"Your enrollment request for {request.offering.course.code} was rejected. Remarks: {request.remarks}",
    )

    return request


def withdraw_enrollment(student: Student, enrollment: Enrollment) -> Enrollment:
    """
    Withdraw enrollment:
    - Enrollment must be Active
    - Offering's semester must be Open
    - Student verification (if student passed)
    - Free the seat, keep history
    - Notify student
    """
    if enrollment.status != EnrollmentStatus.ACTIVE:
        raise EnrollmentValidationError(f"Cannot withdraw enrollment with status '{enrollment.status}'.")

    if enrollment.offering.semester.status != SemesterStatus.OPEN:
        raise EnrollmentValidationError("Cannot withdraw enrollment when semester is not Open.")

    if student and enrollment.student_id != student.pk:
        raise EnrollmentValidationError("Student does not own this enrollment.")

    enrollment.status = EnrollmentStatus.WITHDRAWN
    enrollment.withdrawal_date = timezone.now()
    enrollment.save()

    notify(
        enrollment.student.user,
        NotificationType.ENROLLMENT_WITHDRAWN,
        f"You have successfully withdrawn from {enrollment.offering.course.code}.",
    )

    return enrollment


def recompute_academic_records(student: Student, semester=None):
    """
    Recomputes AcademicRecord(s) and Student.cgpa.
    If semester is given, recomputes that semester.
    Then recomputes overall Student.cgpa across all completed enrollments.
    """
    if semester:
        sem_enrollments = Enrollment.objects.filter(
            student=student, offering__semester=semester
        ).select_related("offering__course")

        credits_registered = sum(
            e.offering.course.credits for e in sem_enrollments if e.status != EnrollmentStatus.WITHDRAWN
        )
        completed = [e for e in sem_enrollments if e.status == EnrollmentStatus.COMPLETED and e.grade_points is not None]
        credits_earned = sum(
            e.offering.course.credits for e in completed if e.grade_points >= PASSING_GRADE_POINTS
        )
        weighted_points = sum(e.grade_points * e.offering.course.credits for e in completed)
        total_graded_credits = sum(e.offering.course.credits for e in completed)
        semester_gpa = (
            Decimal(round(weighted_points / total_graded_credits, 2))
            if total_graded_credits > 0
            else Decimal("0.00")
        )

        record, _ = AcademicRecord.objects.get_or_create(student=student, semester=semester)
        record.credits_registered = credits_registered
        record.credits_earned = credits_earned
        record.semester_gpa = semester_gpa

    # Cumulative CGPA across all completed enrollments
    all_completed = Enrollment.objects.filter(
        student=student, status=EnrollmentStatus.COMPLETED, grade_points__isnull=False
    ).select_related("offering__course")
    cum_weighted = sum(e.grade_points * e.offering.course.credits for e in all_completed)
    cum_credits = sum(e.offering.course.credits for e in all_completed)
    cumulative_cgpa = (
        Decimal(round(cum_weighted / cum_credits, 2)) if cum_credits > 0 else Decimal("0.00")
    )

    if semester:
        record.cumulative_cgpa = cumulative_cgpa
        record.save()

    student.cgpa = cumulative_cgpa
    student.save(update_fields=["cgpa"])


def complete_enrollment(actor, enrollment: Enrollment, grade_points) -> Enrollment:
    """
    Complete enrollment and assign grade points:
    - Actor must be offering's faculty or HOD
    - Enrollment must be Active or Completed
    - Validate grade_points in [0, 10]
    - Recompute AcademicRecord and Student.cgpa
    """
    _check_actor_is_offering_faculty_or_hod(actor, enrollment.offering)

    try:
        gp = Decimal(str(grade_points))
    except Exception:
        raise EnrollmentValidationError("Invalid grade points value.")

    if gp < Decimal("0.00") or gp > Decimal("10.00"):
        raise EnrollmentValidationError("Grade points must be between 0.00 and 10.00.")

    if enrollment.status not in (EnrollmentStatus.ACTIVE, EnrollmentStatus.COMPLETED):
        raise EnrollmentValidationError(f"Cannot complete enrollment with status '{enrollment.status}'.")

    enrollment.status = EnrollmentStatus.COMPLETED
    enrollment.grade_points = gp
    enrollment.save()

    recompute_academic_records(enrollment.student, enrollment.offering.semester)
    return enrollment


def hod_override(actor, target, action: str, reason: str):
    """
    HOD force override:
    - Actor must be HOD
    - Reason mandatory
    - Action: 'approve', 'reject', 'withdraw'
    - Audited in AuditLog
    """
    if actor.role != UserRole.HOD:
        raise EnrollmentValidationError("Only HOD can perform an override.")

    if not reason or not str(reason).strip():
        raise EnrollmentValidationError("Reason is mandatory for HOD override.")

    clean_reason = str(reason).strip()
    action = str(action).lower().strip()

    if action == "approve":
        if not isinstance(target, EnrollmentRequest):
            raise EnrollmentValidationError("Target for approve override must be an EnrollmentRequest.")

        with transaction.atomic():
            target.status = RequestStatus.APPROVED
            target.reviewed_by = actor
            target.reviewed_date = timezone.now()
            target.remarks = f"[HOD Override] {clean_reason}"
            target.save()

            enrollment, created = Enrollment.objects.get_or_create(
                request=target,
                defaults={
                    "student": target.student,
                    "offering": target.offering,
                    "approved_date": timezone.now(),
                    "status": EnrollmentStatus.ACTIVE,
                    "remarks": f"[HOD Override] {clean_reason}",
                },
            )
            if not created:
                enrollment.status = EnrollmentStatus.ACTIVE
                enrollment.remarks = f"[HOD Override] {clean_reason}"
                enrollment.save()

            notify(
                target.student.user,
                NotificationType.REQUEST_APPROVED,
                f"Your enrollment request for {target.offering.course.code} has been approved via HOD override.",
            )
            log_action(
                actor=actor,
                action="HOD_OVERRIDE_APPROVE",
                target_type="enrollments.EnrollmentRequest",
                target_id=target.pk,
                details={"reason": clean_reason, "enrollment_id": enrollment.pk},
            )
            return enrollment

    elif action == "reject":
        if not isinstance(target, EnrollmentRequest):
            raise EnrollmentValidationError("Target for reject override must be an EnrollmentRequest.")

        target.status = RequestStatus.REJECTED
        target.reviewed_by = actor
        target.reviewed_date = timezone.now()
        target.remarks = f"[HOD Override] {clean_reason}"
        target.save()

        notify(
            target.student.user,
            NotificationType.REQUEST_REJECTED,
            f"Your enrollment request for {target.offering.course.code} was rejected by HOD override. Reason: {clean_reason}",
        )
        log_action(
            actor=actor,
            action="HOD_OVERRIDE_REJECT",
            target_type="enrollments.EnrollmentRequest",
            target_id=target.pk,
            details={"reason": clean_reason},
        )
        return target

    elif action == "withdraw":
        if not isinstance(target, Enrollment):
            raise EnrollmentValidationError("Target for withdraw override must be an Enrollment.")

        target.status = EnrollmentStatus.WITHDRAWN
        target.withdrawal_date = timezone.now()
        target.remarks = f"[HOD Override] {clean_reason}"
        target.save()

        notify(
            target.student.user,
            NotificationType.ENROLLMENT_WITHDRAWN,
            f"Your enrollment in {target.offering.course.code} was withdrawn by HOD override. Reason: {clean_reason}",
        )
        log_action(
            actor=actor,
            action="HOD_OVERRIDE_WITHDRAW",
            target_type="enrollments.Enrollment",
            target_id=target.pk,
            details={"reason": clean_reason},
        )
        return target

    else:
        raise EnrollmentValidationError(f"Invalid override action '{action}'. Valid actions: approve, reject, withdraw.")
