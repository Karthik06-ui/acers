# QA Checklist — SEAP-CES

> Generated: 2026-10-28 | Backend: Django 4.x / DRF | Frontend: React + Vite

## SRS Use-Case Coverage

| # | Use Case | Actor | Endpoint / Route | Status |
|---|----------|-------|-----------------|--------|
| UC-01 | Register as Student | Student | `POST /api/auth/register/student/` | ✅ Tested |
| UC-02 | Register as Faculty | Faculty | `POST /api/auth/register/faculty/` | ✅ Tested |
| UC-03 | Login | All | `POST /api/auth/login/` | ✅ Tested |
| UC-04 | Logout / Blacklist token | All | `POST /api/auth/logout/` | ✅ Tested |
| UC-05 | View/Edit own profile | All | `GET/PATCH /api/auth/me/` | ✅ Tested |
| UC-06 | Browse available courses | Student | `GET /api/academics/courses/` | ✅ Tested |
| UC-07 | Submit enrollment request | Student | `POST /api/enrollments/requests/` | ✅ Tested |
| UC-08 | View own requests | Student | `GET /api/enrollments/requests/` | ✅ Tested |
| UC-09 | View own enrollments | Student | `GET /api/enrollments/my/` | ✅ Tested |
| UC-10 | Withdraw from a course | Student | `POST /api/enrollments/<id>/withdraw/` | ✅ Tested |
| UC-11 | View academic record | Student | `GET /api/academic-record/` | ✅ Tested |
| UC-12 | View student dashboard | Student | `GET /api/student/dashboard/` | ✅ Tested |
| UC-13 | View pending requests (faculty) | Faculty | `GET /api/faculty/requests/?status=Pending` | ✅ Tested |
| UC-14 | Approve enrollment request | Faculty | `POST /api/faculty/requests/<id>/approve/` | ✅ Tested |
| UC-15 | Reject enrollment request | Faculty | `POST /api/faculty/requests/<id>/reject/` | ✅ Tested |
| UC-16 | View enrolled students | Faculty | `GET /api/faculty/offerings/<id>/students/` | ✅ Tested |
| UC-17 | Complete enrollment (grade) | Faculty | `POST /api/faculty/enrollments/<id>/complete/` | ✅ Tested |
| UC-18 | View faculty dashboard | Faculty | `GET /api/faculty/dashboard/` | ✅ Tested |
| UC-19 | HOD: Approve faculty account | HOD | `POST /api/auth/hod/faculty/<id>/approve/` | ✅ Tested |
| UC-20 | HOD: Reject faculty account | HOD | `POST /api/auth/hod/faculty/<id>/reject/` | ✅ Tested |
| UC-21 | HOD: Activate/Deactivate faculty | HOD | `POST /api/auth/hod/faculty/<id>/activate|deactivate/` | ✅ Tested |
| UC-22 | HOD: Edit faculty profile | HOD | `PATCH /api/auth/hod/faculty/<id>/` | ✅ Manual |
| UC-23 | HOD: List/filter students | HOD | `GET /api/auth/hod/students/` | ✅ Tested |
| UC-24 | HOD: Edit student & change status | HOD | `PATCH/POST /api/auth/hod/students/<id>/` | ✅ Tested |
| UC-25 | HOD: View/edit academic records | HOD | `GET/PATCH /api/hod/academic-records/<id>/` | ✅ Tested |
| UC-26 | HOD: Override enrollment/request | HOD | `POST /api/hod/override/` | ✅ Tested |
| UC-27 | HOD: CRUD departments | HOD | `GET/POST/PATCH/DELETE /api/academics/departments/` | ✅ Tested |
| UC-28 | HOD: CRUD semesters + open/close | HOD | `GET/POST/PATCH /api/academics/semesters/` | ✅ Tested |
| UC-29 | HOD: CRUD courses | HOD | `GET/POST/PATCH/DELETE /api/academics/courses/` | ✅ Tested |
| UC-30 | HOD: CRUD offerings + assign faculty | HOD | `GET/POST/PATCH/DELETE /api/academics/offerings/` | ✅ Tested |
| UC-31 | HOD: View all enrollments | HOD | `GET /api/hod/enrollments/` | ✅ Tested |
| UC-32 | HOD: Generate reports + CSV export | HOD | `GET /api/hod/reports/?type=&format=` | ✅ Manual |
| UC-33 | HOD: View audit log | HOD | `GET /api/hod/audit-logs/` | ✅ Tested |
| UC-34 | HOD: Dashboard stats + charts | HOD | `GET /api/hod/dashboard/` | ✅ Tested |
| UC-35 | Receive notifications | All | `GET /api/notifications/` | ✅ Tested |
| UC-36 | Mark notification read | All | `POST /api/notifications/<id>/read/` | ✅ Tested |

---

## Security Checklist

| Check | Result |
|-------|--------|
| Every HOD endpoint has `IsHOD` permission class | ✅ |
| Every Faculty endpoint has `IsApprovedFaculty` | ✅ |
| Student endpoints scoped to own data (queryset filtering) | ✅ |
| Swapped-ID: student cannot read/write another student's HOD detail | ✅ Tested |
| Swapped-ID: student cannot withdraw another's enrollment | ✅ Tested |
| Swapped-ID: faculty cannot view another faculty's offering students | ✅ Tested |
| Swapped-ID: faculty cannot approve another faculty's request | ✅ Tested |
| Passwords never appear in any API response | ✅ Tested |
| Unauthenticated requests return 401 | ✅ Tested |
| CORS restricted to configured origins (env var) | ✅ |
| `SESSION_COOKIE_SECURE` / `CSRF_COOKIE_SECURE` set to True when `DEBUG=False` | ✅ |
| `X_FRAME_OPTIONS = DENY` | ✅ |
| `SECURE_CONTENT_TYPE_NOSNIFF = True` | ✅ |
| Token blacklisted on logout | ✅ Tested |
| Pending faculty cannot access faculty endpoints | ✅ Tested |
| Rejected faculty cannot login | ✅ Tested |

---

## Query Count Check (List Endpoints)

| Endpoint | select_related / prefetch | N+1 Risk |
|----------|--------------------------|----------|
| `GET /api/auth/hod/faculty/` | `select_related("user","department")` | ✅ None |
| `GET /api/auth/hod/students/` | `select_related("user","department")` | ✅ None |
| `GET /api/hod/enrollments/` | `select_related("student","offering__course","offering__faculty","offering__semester")` | ✅ None |
| `GET /api/hod/requests/` | same as above + `reviewed_by` | ✅ None |
| `GET /api/faculty/requests/` | `select_related("student","student__department","offering__course","offering__semester","reviewed_by")` | ✅ None |
| `GET /api/hod/dashboard/` | annotated `Count` query; no per-offering Python loop for enrollment counts | ✅ Fixed |
| `GET /api/academics/courses/` | `select_related("department").prefetch_related("offerings")` | ✅ None |

---

## Playwright Smoke Tests

Located in [`tests/e2e/smoke.spec.ts`](../tests/e2e/smoke.spec.ts).

| Test | Scenario |
|------|----------|
| `01-register-student` | New student registers and lands on /pending or dashboard |
| `02-register-faculty` | New faculty registers and sees pending approval page |
| `03-login-student` | Seeded student logs in and sees dashboard |
| `04-login-faculty` | Seeded approved faculty logs in, sees faculty dashboard |
| `05-login-hod` | HOD logs in and sees admin dashboard |
| `06-faculty-approval-flow` | HOD approves pending faculty → faculty can log in normally |
| `07-enrollment-flow` | Student requests → faculty approves → student sees Active enrollment |
| `08-withdrawal-flow` | Student withdraws active enrollment |
| `09-hod-approves-faculty` | Full HOD journey: pending → approve → faculty teaches course |

---

## Checkpoint Verification

> **CHECKPOINT**: An HOD takes a new faculty account from Pending to teaching a course with live enrollments, every sensitive action shows in the audit log, and all tests pass.

| Step | Action | Audit Log Entry |
|------|--------|----------------|
| 1 | Faculty registers (Pending) | — |
| 2 | HOD approves faculty | `APPROVE_FACULTY` |
| 3 | HOD creates course offering and assigns faculty | `CREATE_OFFERING` |
| 4 | Student submits enrollment request | — |
| 5 | Faculty approves request | `APPROVE_REQUEST` |
| 6 | Student's enrollment is Active | — |
| 7 | HOD views dashboard — sees live enrollment count | — |
| 8 | HOD views audit log — sees steps 2, 3, 5 | ✅ All visible |

**Backend test suite**: `39 tests passed` (original) + `21 security tests passed` = **60 tests, 0 failures**

