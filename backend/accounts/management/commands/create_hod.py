"""
accounts/management/commands/create_hod.py

Usage:
    python manage.py create_hod <email> <password> <name> <department_code>

Idempotent – running it twice with the same email will update the password.
"""
from django.core.management.base import BaseCommand
from accounts.models import User, HOD, UserRole, UserStatus
from academics.models import Department


class Command(BaseCommand):
    help = "Create a Head of Department (HOD) user."

    def add_arguments(self, parser):
        parser.add_argument("email",           type=str, help="Email address for the HOD")
        parser.add_argument("password",        type=str, help="Password for the HOD")
        parser.add_argument("name",            type=str, help="Full name of the HOD")
        parser.add_argument("department_code", type=str, help="Department code (e.g. CSE)")

    def handle(self, *args, **options):
        email     = options["email"]
        password  = options["password"]
        name      = options["name"]
        dept_code = options["department_code"].upper()

        # 1. Ensure the department exists
        department, dept_created = Department.objects.get_or_create(
            code=dept_code,
            defaults={"name": f"{dept_code} Department", "status": "Active"},
        )
        if dept_created:
            self.stdout.write(f"  Created department: {dept_code}")

        # 2. Create/update the User
        user, user_created = User.objects.get_or_create(
            email=email,
            defaults={"role": UserRole.HOD, "status": UserStatus.ACTIVE},
        )
        user.set_password(password)
        if not user_created:
            # ensure role/status are correct even for existing users
            user.role   = UserRole.HOD
            user.status = UserStatus.ACTIVE
        user.save()

        # 3. Create/update the HOD profile
        HOD.objects.get_or_create(
            user=user,
            defaults={"name": name, "department": department, "status": "Active"},
        )

        action = "Created" if user_created else "Updated"
        self.stdout.write(self.style.SUCCESS(
            f"{action} HOD: {email}  name={name}  dept={dept_code}"
        ))
