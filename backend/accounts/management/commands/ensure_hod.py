"""
accounts/management/commands/ensure_hod.py

Idempotently creates the Head of Department (HOD) user and profile from
environment variables:
  - HOD_EMAIL
  - HOD_PASSWORD
  - HOD_NAME (default: "HOD")
  - HOD_DEPT_CODE (default: "CSE")
  - HOD_DEPT_NAME (default: "Computer Science")

Rules:
  - If HOD_EMAIL or HOD_PASSWORD is missing -> prints "skipping" and returns.
  - If user with HOD_EMAIL exists -> prints "HOD already exists, skipping" and returns.
  - Otherwise creates Department, User (role=HOD, is_staff=True, is_superuser=True),
    and HOD profile.
"""
import os
from django.core.management.base import BaseCommand
from django.contrib.auth import get_user_model
from django.db import transaction

from accounts.models import HOD, UserRole, UserStatus
from academics.models import Department, DepartmentStatus


class Command(BaseCommand):
    help = "Create the HOD account from environment variables if it does not exist."

    def handle(self, *args, **options):
        email = os.environ.get("HOD_EMAIL")
        password = os.environ.get("HOD_PASSWORD")

        if not email or not password:
            self.stdout.write("skipping")
            return

        User = get_user_model()
        if User.objects.filter(email=email).exists():
            self.stdout.write("HOD already exists, skipping")
            return

        name = os.environ.get("HOD_NAME", "HOD")
        dept_code = os.environ.get("HOD_DEPT_CODE", "CSE").strip()
        dept_name = os.environ.get("HOD_DEPT_NAME", "Computer Science").strip()

        with transaction.atomic():
            department, _ = Department.objects.get_or_create(
                code=dept_code,
                defaults={
                    "name": dept_name,
                    "status": DepartmentStatus.ACTIVE,
                },
            )

            user = User.objects.create_user(
                email=email,
                password=password,
                role=UserRole.HOD,
                status=UserStatus.ACTIVE,
                is_staff=True,
                is_superuser=True,
            )
            # Ensure staff & superuser permissions are explicitly saved
            user.is_staff = True
            user.is_superuser = True
            user.save()

            HOD.objects.create(
                user=user,
                department=department,
                name=name,
                status=HOD.HODStatus.ACTIVE,
            )

        self.stdout.write(self.style.SUCCESS("HOD created"))
