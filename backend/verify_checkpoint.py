import os
import django

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')
django.setup()

from rest_framework.test import APIClient
from accounts.models import User, Student, Faculty
from academics.models import Department, CourseOffering, Course

client = APIClient()

print("--- 1. Testing Login as Seeded Roles ---")
# Seeded HOD
res = client.post('/api/auth/login/', {'email': 'hod@demo.com', 'password': 'Demo@1234'}, format='json')
assert res.status_code == 200, f"HOD login failed: {res.data}"
assert res.data['role'] == 'HOD', f"Wrong role: {res.data}"
print("[PASS] Seeded HOD login successful")

# Seeded Faculty (approved)
res = client.post('/api/auth/login/', {'email': 'alice@demo.com', 'password': 'Demo@1234'}, format='json')
assert res.status_code == 200, f"Alice login failed: {res.data}"
assert res.data['role'] == 'FACULTY', f"Wrong role: {res.data}"
assert res.data['pending_approval'] is False, f"Expected pending_approval=False: {res.data}"
print("[PASS] Seeded Approved Faculty login successful")

# Seeded Faculty (pending approval)
res = client.post('/api/auth/login/', {'email': 'dave@demo.com', 'password': 'Demo@1234'}, format='json')
assert res.status_code == 200, f"Dave login failed: {res.data}"
assert res.data['role'] == 'FACULTY', f"Wrong role: {res.data}"
assert res.data['pending_approval'] is True, f"Expected pending_approval=True: {res.data}"
print("[PASS] Seeded Pending Faculty login successful (pending_approval=True)")

# Seeded Student
res = client.post('/api/auth/login/', {'email': 's001@demo.com', 'password': 'Demo@1234'}, format='json')
assert res.status_code == 200, f"s001 login failed: {res.data}"
assert res.data['role'] == 'STUDENT', f"Wrong role: {res.data}"
print("[PASS] Seeded Student login successful")

print("\n--- 2. Testing Registration for New Student and Faculty ---")
# Clean up prior test accounts if any
from enrollments.models import Enrollment, EnrollmentRequest
from accounts.models import Student as StudentModel, Faculty as FacultyModel
test_emails = ['new_stu_test@demo.com', 'new_fac_test@demo.com']
test_students = StudentModel.objects.filter(user__email__in=test_emails)
test_stu_ids = list(test_students.values_list('id', flat=True))
Enrollment.objects.filter(student__id__in=test_stu_ids).delete()
EnrollmentRequest.objects.filter(student__id__in=test_stu_ids).delete()
User.objects.filter(email__in=test_emails).delete()

# Register new student
s_payload = {
    'email': 'new_stu_test@demo.com',
    'password': 'SecurePassword@123',
    'name': 'Test New Student',
    'roll_no': 'TESTSTU001',
    'phone': '9876543210'
}
res = client.post('/api/auth/register/student/', s_payload, format='json')
assert res.status_code == 201, f"Student register failed: {res.data}"
print("[PASS] Student registration successful")

# Log in as newly registered student
res = client.post('/api/auth/login/', {'email': 'new_stu_test@demo.com', 'password': 'SecurePassword@123'}, format='json')
assert res.status_code == 200, f"New student login failed: {res.data}"
assert res.data['role'] == 'STUDENT'
stu_token = res.data['access']
print("[PASS] New student login successful")

# Register new faculty
f_payload = {
    'email': 'new_fac_test@demo.com',
    'password': 'SecurePassword@123',
    'name': 'Test New Faculty',
    'designation': 'Assistant Professor',
    'phone': '9876543211'
}
res = client.post('/api/auth/register/faculty/', f_payload, format='json')
assert res.status_code == 201, f"Faculty register failed: {res.data}"
print("[PASS] Faculty registration successful (defaults to Pending approval)")

# Log in as newly registered faculty -> check pending approval state
res = client.post('/api/auth/login/', {'email': 'new_fac_test@demo.com', 'password': 'SecurePassword@123'}, format='json')
assert res.status_code == 200, f"New faculty login failed: {res.data}"
assert res.data['role'] == 'FACULTY'
assert res.data['pending_approval'] is True, f"Expected pending_approval=True: {res.data}"
print("[PASS] New faculty login confirms pending_approval=True gate")

print("\n--- 3. Testing Student Request -> Faculty Approve -> Student Active Flow ---")
# 1. Log in as Alice (faculty) to find one of her offerings
res = client.post('/api/auth/login/', {'email': 'alice@demo.com', 'password': 'Demo@1234'}, format='json')
fac_token = res.data['access']
fac_client = APIClient()
fac_client.credentials(HTTP_AUTHORIZATION=f'Bearer {fac_token}')

offering = CourseOffering.objects.filter(faculty__user__email='alice@demo.com', semester__status='Open').first()
assert offering is not None, "Alice has no open offerings!"
print(f"Target Offering: {offering.course.code} - {offering.course.name} (ID: {offering.id})")

# 2. Student requests enrollment
stu_client = APIClient()
stu_client.credentials(HTTP_AUTHORIZATION=f'Bearer {stu_token}')

res = stu_client.post('/api/enrollments/requests/', {'offering': offering.id}, format='json')
assert res.status_code == 201, f"Request enrollment failed: {res.data}"
request_id = res.data['id']
assert res.data['status'] == 'Pending', f"Expected status Pending: {res.data}"
print(f"[PASS] Student requested enrollment: Request ID {request_id}, status={res.data['status']}")

# 3. Faculty views pending requests
res = fac_client.get('/api/faculty/requests/?status=Pending')
assert res.status_code == 200, f"Faculty get requests failed: {res.data}"
req_matches = [r for r in res.data['results'] if r['id'] == request_id]
assert len(req_matches) == 1, "Pending request not visible in faculty requests list"
print(f"[PASS] Faculty found pending request in queue")

# 4. Faculty approves request
# Note: approve endpoint returns Enrollment object with status='Active'
res = fac_client.post(f'/api/faculty/requests/{request_id}/approve/', {'remarks': 'Approved! Welcome to the course.'}, format='json')
assert res.status_code == 200, f"Faculty approve failed: {res.data}"
assert res.data['status'] == 'Active', f"Expected enrollment status Active: {res.data}"
print(f"[PASS] Faculty approved request: enrollment status={res.data['status']}")

# 5. Student checks enrollments and sees 'Active' status
res = stu_client.get('/api/enrollments/my/')
assert res.status_code == 200, f"Student get enrollments failed: {res.data}"
enrolled_offering_ids = [e['offering']['id'] for e in res.data['results'] if e['status'] == 'Active']
assert offering.id in enrolled_offering_ids, f"Offering {offering.id} not found among Active enrollments: {res.data}"
print(f"[PASS] Student sees Active enrollment for course {offering.course.code}!")

print("\nAll checkpoint test requirements PASSED successfully!")
