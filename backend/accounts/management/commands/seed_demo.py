"""
accounts/management/commands/seed_demo.py

Creates a full, deterministic demo dataset:
  - 2 Departments (CSE, ECE)
  - 2 Semesters (2024-2025 Odd = Open, 2024-2025 Even = Upcoming)
  - 1 HOD  (hod@demo.com / Demo@1234)
  - 3 Approved+Active Faculty, 1 Pending Faculty
  - 15 Courses (various types, some with minimum_cgpa, statuses)
  - 15 CourseOfferings (>=1 at full capacity)
  - 10 Students with varied CGPA

Fully idempotent - safe to run multiple times.

At the end, demo logins are printed.
"""
import datetime
from decimal import Decimal

from django.conf import settings
from django.core.management.base import BaseCommand, CommandError
from django.db import transaction

from accounts.models import (
    User, Student, Faculty, HOD,
    UserRole, UserStatus, ApprovalStatus, AccountStatus,
)
from academics.models import (
    Department, Semester, Course, CourseOffering,
    DepartmentStatus, SemesterStatus, SemesterName,
    CourseType, CourseStatus, OfferingStatus,
)


# ── helpers ───────────────────────────────────────────────────────────────────

def make_user(email, password, role, status=UserStatus.ACTIVE):
    user, created = User.objects.get_or_create(
        email=email,
        defaults={"role": role, "status": status},
    )
    # Always keep password in sync so seed is re-runnable
    user.set_password(password)
    user.role   = role
    user.status = status
    user.save()
    return user


# ── main command ──────────────────────────────────────────────────────────────

class Command(BaseCommand):
    help = "Seed the database with deterministic demo data (idempotent)."

    def add_arguments(self, parser):
        parser.add_argument(
            "--force",
            action="store_true",
            help="Allow seeding even when DEBUG=False",
        )

    def handle(self, *args, **options):
        if not settings.DEBUG and not options.get("force"):
            raise CommandError("seed_demo refuses to run with DEBUG=False. Use --force to override.")

        with transaction.atomic():
            self._seed()

    def _seed(self):
        w = self.stdout.write
        ok = self.style.SUCCESS

        # ── Departments ───────────────────────────────────────────────────────
        w("-- Departments ...")
        cse, _ = Department.objects.get_or_create(
            code="CSE",
            defaults={"name": "Computer Science and Engineering", "status": DepartmentStatus.ACTIVE},
        )
        ece, _ = Department.objects.get_or_create(
            code="ECE",
            defaults={"name": "Electronics and Communication Engineering", "status": DepartmentStatus.ACTIVE},
        )

        # ── Semesters ─────────────────────────────────────────────────────────
        w("-- Semesters ...")
        sem_open, _ = Semester.objects.get_or_create(
            academic_year="2024-2025",
            semester_name=SemesterName.ODD,
            defaults={
                "start_date": datetime.date(2024, 7, 15),
                "end_date":   datetime.date(2024, 11, 30),
                "status":     SemesterStatus.OPEN,
            },
        )
        # Keep status Open even on re-run
        if sem_open.status != SemesterStatus.OPEN:
            sem_open.status = SemesterStatus.OPEN
            sem_open.save()

        sem_upcoming, _ = Semester.objects.get_or_create(
            academic_year="2024-2025",
            semester_name=SemesterName.EVEN,
            defaults={
                "start_date": datetime.date(2025, 1, 6),
                "end_date":   datetime.date(2025, 5, 30),
                "status":     SemesterStatus.UPCOMING,
            },
        )

        # ── HOD ───────────────────────────────────────────────────────────────
        w("-- HOD ...")
        hod_user = make_user("hod@demo.com", "Demo@1234", UserRole.HOD)
        HOD.objects.get_or_create(
            user=hod_user,
            defaults={"name": "Dr. Rajan Verma", "department": cse, "status": "Active"},
        )

        # ── Faculty ───────────────────────────────────────────────────────────
        w("-- Faculty ...")
        faculty_data = [
            # (email, password, name, dept, designation, approval, account)
            ("alice@demo.com", "Demo@1234", "Dr. Alice Thomas",
             cse, "Professor", ApprovalStatus.APPROVED, AccountStatus.ACTIVE),
            ("bob@demo.com",   "Demo@1234", "Prof. Bob Mathew",
             cse, "Assistant Professor", ApprovalStatus.APPROVED, AccountStatus.ACTIVE),
            ("carol@demo.com", "Demo@1234", "Dr. Carol Singh",
             ece, "Associate Professor", ApprovalStatus.APPROVED, AccountStatus.ACTIVE),
            ("dave@demo.com",  "Demo@1234", "Mr. Dave Kumar",
             ece, "Lecturer", ApprovalStatus.PENDING, AccountStatus.PENDING),
        ]

        faculty_objs = {}
        for email, pwd, name, dept, designation, appr, acct in faculty_data:
            u = make_user(email, pwd, UserRole.FACULTY)
            f, _ = Faculty.objects.get_or_create(
                user=u,
                defaults={
                    "name": name, "department": dept,
                    "designation": designation,
                    "approval_status": appr, "account_status": acct,
                },
            )
            # Keep approval/account status current
            f.approval_status = appr
            f.account_status  = acct
            f.save()
            faculty_objs[email] = f

        alice = faculty_objs["alice@demo.com"]
        bob   = faculty_objs["bob@demo.com"]
        carol = faculty_objs["carol@demo.com"]

        # ── Courses ───────────────────────────────────────────────────────────
        w("-- Courses ...")
        courses_data = [
            # (code, name, dept, credits, type, capacity, min_cgpa, status)
            ("CS101", "Introduction to Programming",       cse, 4, CourseType.THEORY,     60, None,           CourseStatus.OPEN),
            ("CS102", "Data Structures",                   cse, 4, CourseType.THEORY,     50, None,           CourseStatus.OPEN),
            ("CS201", "Design and Analysis of Algorithms", cse, 4, CourseType.THEORY,     40, Decimal("6.0"), CourseStatus.OPEN),
            ("CS202", "Database Management Systems",       cse, 4, CourseType.THEORY_LAB, 45, None,           CourseStatus.OPEN),
            ("CS203", "Operating Systems",                 cse, 4, CourseType.THEORY,     40, None,           CourseStatus.OPEN),
            ("CS301", "Computer Networks",                 cse, 4, CourseType.THEORY_LAB, 40, Decimal("6.5"), CourseStatus.OPEN),
            ("CS302", "Machine Learning",                  cse, 4, CourseType.THEORY,     35, Decimal("7.0"), CourseStatus.OPEN),
            ("CS303", "Web Technologies Lab",              cse, 2, CourseType.LAB,        30, None,           CourseStatus.OPEN),
            ("CS401", "Compiler Design",                   cse, 4, CourseType.THEORY,     30, Decimal("7.5"), CourseStatus.OPEN),
            ("CS402", "Cloud Computing",                   cse, 3, CourseType.THEORY,     50, None,           CourseStatus.OPEN),
            ("EC101", "Basic Electronics",                 ece, 4, CourseType.THEORY,     60, None,           CourseStatus.OPEN),
            ("EC102", "Signals and Systems",               ece, 4, CourseType.THEORY,     50, None,           CourseStatus.OPEN),
            ("EC201", "Digital Signal Processing",         ece, 4, CourseType.THEORY_LAB, 40, Decimal("6.0"), CourseStatus.OPEN),
            ("EC301", "VLSI Design",                       ece, 4, CourseType.THEORY,     35, Decimal("7.0"), CourseStatus.OPEN),
            ("EC302", "Embedded Systems Lab",              ece, 2, CourseType.LAB,        25, None,           CourseStatus.OPEN),
        ]

        course_objs = {}
        for code, name, dept, credits, ctype, capacity, min_cgpa, cstatus in courses_data:
            c, _ = Course.objects.get_or_create(
                code=code,
                defaults={
                    "name": name, "department": dept, "credits": credits,
                    "course_type": ctype, "capacity": capacity,
                    "minimum_cgpa": min_cgpa, "status": cstatus,
                },
            )
            course_objs[code] = c

        # ── CourseOfferings ───────────────────────────────────────────────────
        w("-- CourseOfferings ...")
        # (course_code, faculty, semester, capacity_override, status)
        # capacity_override=None -> inherit course.capacity
        offerings_data = [
            ("CS101", alice, sem_open,     None, OfferingStatus.OPEN),
            ("CS102", alice, sem_open,     None, OfferingStatus.OPEN),
            ("CS201", alice, sem_open,     None, OfferingStatus.OPEN),
            ("CS202", bob,   sem_open,     None, OfferingStatus.OPEN),
            ("CS203", bob,   sem_open,     None, OfferingStatus.OPEN),
            ("CS301", bob,   sem_open,     None, OfferingStatus.OPEN),
            ("CS302", alice, sem_open,     None, OfferingStatus.OPEN),
            ("CS303", bob,   sem_open,     None, OfferingStatus.OPEN),
            ("CS401", alice, sem_upcoming, None, OfferingStatus.OPEN),
            ("CS402", bob,   sem_upcoming, None, OfferingStatus.OPEN),
            ("EC101", carol, sem_open,     None, OfferingStatus.OPEN),
            ("EC102", carol, sem_open,     None, OfferingStatus.OPEN),
            ("EC201", carol, sem_open,     None, OfferingStatus.OPEN),
            ("EC301", carol, sem_upcoming, None, OfferingStatus.OPEN),
            # One offering at full capacity (capacity=1 to guarantee it is full)
            ("EC302", carol, sem_open,     1,    OfferingStatus.CLOSED),
        ]

        offering_objs = {}
        for code, faculty, semester, cap_override, ostatus in offerings_data:
            course = course_objs[code]
            capacity = cap_override if cap_override is not None else course.capacity
            offering, created = CourseOffering.objects.get_or_create(
                course=course, faculty=faculty, semester=semester,
                defaults={"capacity": capacity, "status": ostatus},
            )
            if not created:
                # Sync status on re-run
                offering.status = ostatus
                offering.save()
            offering_objs[code] = offering

        # ── Students ──────────────────────────────────────────────────────────
        w("-- Students ...")
        students_data = [
            # (email, roll_no, name, dept, year, cgpa)
            ("s001@demo.com", "CSE2021001", "Aarav Sharma",   cse, 4, Decimal("8.90")),
            ("s002@demo.com", "CSE2021002", "Bhavya Nair",    cse, 4, Decimal("7.20")),
            ("s003@demo.com", "CSE2022001", "Chirag Patel",   cse, 3, Decimal("6.80")),
            ("s004@demo.com", "CSE2022002", "Diya Menon",     cse, 3, Decimal("5.50")),
            ("s005@demo.com", "CSE2023001", "Eshan Gupta",    cse, 2, Decimal("9.10")),
            ("s006@demo.com", "CSE2023002", "Farida Begum",   cse, 2, Decimal("6.00")),
            ("s007@demo.com", "CSE2024001", "Gautam Rao",     cse, 1, Decimal("0.00")),
            ("s008@demo.com", "ECE2021001", "Harini Reddy",   ece, 4, Decimal("7.75")),
            ("s009@demo.com", "ECE2022001", "Ishan Tiwari",   ece, 3, Decimal("5.80")),
            ("s010@demo.com", "ECE2023001", "Jasmine George", ece, 2, Decimal("8.40")),
        ]

        for email, roll_no, name, dept, year, cgpa in students_data:
            u = make_user(email, "Demo@1234", UserRole.STUDENT)
            Student.objects.get_or_create(
                user=u,
                defaults={
                    "name": name, "roll_no": roll_no,
                    "department": dept, "year": year, "cgpa": cgpa,
                    "status": "Active",
                },
            )

        # ── Print logins ──────────────────────────────────────────────────────
        w("")
        w(ok("=" * 62))
        w(ok("  DEMO LOGINS  (all passwords: Demo@1234)"))
        w(ok("=" * 62))
        w(ok("  HOD:"))
        w(ok("    hod@demo.com          / Demo@1234"))
        w(ok("  FACULTY (Approved):"))
        w(ok("    alice@demo.com        / Demo@1234  (CSE - Professor)"))
        w(ok("    bob@demo.com          / Demo@1234  (CSE - Asst. Prof)"))
        w(ok("    carol@demo.com        / Demo@1234  (ECE - Assoc. Prof)"))
        w(ok("  FACULTY (Pending - not yet approved):"))
        w(ok("    dave@demo.com         / Demo@1234"))
        w(ok("  STUDENTS (10):"))
        for email, roll_no, name, _, _, cgpa in students_data:
            w(ok("    {:<28} CGPA={:<5} roll={}".format(email, str(cgpa), roll_no)))
        w(ok("=" * 62))
        w(ok("Seed complete!"))
