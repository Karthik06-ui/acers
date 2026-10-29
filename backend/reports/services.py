"""
reports/services.py
Generates reports for HOD in JSON and CSV formats:
- enrollment-by-course
- enrollment-by-department
- faculty-load
- student-academic-summary
- pending-requests
"""
import csv
import io
from django.http import HttpResponse
from rest_framework.exceptions import ValidationError

from academics.models import Department, Semester, CourseOffering
from accounts.models import Student, Faculty
from enrollments.models import Enrollment, EnrollmentRequest, RequestStatus, EnrollmentStatus


def generate_report_data(report_type: str, semester_id=None, department_id=None):
    """Generate structured dictionary/list data for the given report type."""
    if report_type == "enrollment-by-course":
        qs = CourseOffering.objects.select_related("course", "course__department", "faculty", "semester").all()
        if semester_id:
            qs = qs.filter(semester_id=semester_id)
        if department_id:
            qs = qs.filter(course__department_id=department_id)

        rows = []
        for o in qs:
            rows.append({
                "offering_id": o.id,
                "course_code": o.course.code,
                "course_name": o.course.name,
                "department": o.course.department.code if o.course.department else "",
                "semester": f"{o.semester.academic_year} {o.semester.semester_name}",
                "faculty": o.faculty.name,
                "capacity": o.capacity,
                "active_enrollments": o.active_enrollment_count,
                "seats_available": o.seats_available,
                "status": o.status,
            })
        headers = [
            "offering_id", "course_code", "course_name", "department",
            "semester", "faculty", "capacity", "active_enrollments",
            "seats_available", "status"
        ]
        return rows, headers

    elif report_type == "enrollment-by-department":
        qs = Department.objects.all()
        if department_id:
            qs = qs.filter(id=department_id)

        rows = []
        for d in qs:
            offerings = CourseOffering.objects.filter(course__department=d)
            if semester_id:
                offerings = offerings.filter(semester_id=semester_id)
            active_enrollments = Enrollment.objects.filter(
                offering__in=offerings, status=EnrollmentStatus.ACTIVE
            ).count()

            rows.append({
                "department_code": d.code,
                "department_name": d.name,
                "total_courses": d.courses.count(),
                "total_offerings": offerings.count(),
                "total_students": d.students.count(),
                "total_active_enrollments": active_enrollments,
            })
        headers = [
            "department_code", "department_name", "total_courses",
            "total_offerings", "total_students", "total_active_enrollments"
        ]
        return rows, headers

    elif report_type == "faculty-load":
        qs = Faculty.objects.select_related("department", "user").all()
        if department_id:
            qs = qs.filter(department_id=department_id)

        rows = []
        for f in qs:
            offerings = CourseOffering.objects.filter(faculty=f)
            if semester_id:
                offerings = offerings.filter(semester_id=semester_id)
            total_students = Enrollment.objects.filter(
                offering__in=offerings, status=EnrollmentStatus.ACTIVE
            ).count()

            rows.append({
                "faculty_id": f.id,
                "faculty_name": f.name,
                "email": f.user.email,
                "department": f.department.code if f.department else "",
                "designation": f.designation,
                "offerings_count": offerings.count(),
                "total_students_enrolled": total_students,
            })
        headers = [
            "faculty_id", "faculty_name", "email", "department",
            "designation", "offerings_count", "total_students_enrolled"
        ]
        return rows, headers

    elif report_type == "student-academic-summary":
        qs = Student.objects.select_related("department", "user").all()
        if department_id:
            qs = qs.filter(department_id=department_id)

        rows = []
        for s in qs:
            active_count = s.enrollments.filter(status=EnrollmentStatus.ACTIVE).count()
            completed = s.enrollments.filter(status=EnrollmentStatus.COMPLETED, grade_points__gte=4)
            credits_earned = sum(e.offering.course.credits for e in completed)

            rows.append({
                "student_id": s.id,
                "roll_no": s.roll_no,
                "name": s.name,
                "department": s.department.code if s.department else "",
                "year": s.year,
                "cgpa": str(s.cgpa),
                "credits_earned": credits_earned,
                "active_enrollments_count": active_count,
            })
        headers = [
            "student_id", "roll_no", "name", "department",
            "year", "cgpa", "credits_earned", "active_enrollments_count"
        ]
        return rows, headers

    elif report_type == "pending-requests":
        qs = EnrollmentRequest.objects.filter(status=RequestStatus.PENDING).select_related(
            "student", "student__department", "offering__course", "offering__faculty", "offering__semester"
        )
        if semester_id:
            qs = qs.filter(offering__semester_id=semester_id)
        if department_id:
            qs = qs.filter(offering__course__department_id=department_id)

        rows = []
        for r in qs:
            rows.append({
                "request_id": r.id,
                "student_roll_no": r.student.roll_no,
                "student_name": r.student.name,
                "course_code": r.offering.course.code,
                "course_name": r.offering.course.name,
                "faculty_name": r.offering.faculty.name,
                "semester": f"{r.offering.semester.academic_year} {r.offering.semester.semester_name}",
                "request_date": r.request_date.isoformat(),
            })
        headers = [
            "request_id", "student_roll_no", "student_name", "course_code",
            "course_name", "faculty_name", "semester", "request_date"
        ]
        return rows, headers

    else:
        raise ValidationError(
            f"Invalid report type '{report_type}'. Valid types: "
            "enrollment-by-course, enrollment-by-department, faculty-load, "
            "student-academic-summary, pending-requests."
        )


def export_csv(rows, headers, filename="report.csv") -> HttpResponse:
    """Generate a downloadable CSV HttpResponse."""
    response = HttpResponse(content_type="text/csv")
    response["Content-Disposition"] = f'attachment; filename="{filename}"'

    writer = csv.DictWriter(response, fieldnames=headers)
    writer.writeheader()
    for row in rows:
        writer.writerow(row)
    return response
