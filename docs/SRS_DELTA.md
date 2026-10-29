# SRS Delta — Additions and Deviations from Original SRS

This document records every deliberate deviation from, or addition to, the original System Requirements Specification (SRS) for the Academic Course Enrolment and Registration System (SEAP-CES).

---

## 1. New Entities / Fields

### 1.1 `AuditLog`
| Field | Type | Notes |
|---|---|---|
| `actor` | FK → User | Who performed the action |
| `action` | CharField | e.g. `APPROVE_FACULTY`, `REJECT_REQUEST`, `EDIT_GRADE` |
| `target_type` | CharField | Model name of the object acted on |
| `target_id` | IntegerField | PK of the object |
| `details` | JSONField | Snapshot of before/after or extra context |
| `created_at` | DateTimeField | Auto-set, immutable |

**Rationale:** The SRS mentioned audit requirements in the non-functional section but did not specify an entity. An immutable append-only log is necessary to satisfy HOD oversight and accountability requirements.

### 1.2 `Notification`
| Field | Type | Notes |
|---|---|---|
| `recipient` | FK → User | |
| `verb` | CharField | Short human-readable action description |
| `target_type` | CharField | Model name |
| `target_id` | IntegerField | PK |
| `is_read` | BooleanField | Default False |
| `created_at` | DateTimeField | Auto-set |

**Rationale:** Not specified in the SRS. Added to close the feedback loop for students (notify on request approve/reject/completion) and faculty (notify on new enrollment / course assignment).

### 1.3 `grade_points` on `Enrollment`
| Field | Type | Notes |
|---|---|---|
| `grade_points` | DecimalField(max_digits=4, decimal_places=2) | Nullable; 0–10 scale |

**Rationale:** The SRS specified that faculty mark a course as "Completed" for a student but did not include a grade. `grade_points` is required to compute `AcademicRecord.cgpa`. Added alongside the `COMPLETED` enrollment status.

### 1.4 `AcademicRecord`
| Field | Type | Notes |
|---|---|---|
| `student` | FK → Student | |
| `semester` | FK → Semester | |
| `gpa` | DecimalField | Semester GPA |
| `credits_earned` | IntegerField | |
| `created_at` / `updated_at` | DateTimeField | Auto-managed |

**Rationale:** Implied by the SRS requirement "HOD can view academic records" but not modelled. Implemented as a first-class entity computed from completed enrollments; HOD can manually override individual records with a confirmation step.

---

## 2. New Endpoints (not in original SRS)

| Endpoint | Method | Actor | Purpose |
|---|---|---|---|
| `/api/hod/override-enrollment/` | POST | HOD | Force-approve a rejected or pending request with a mandatory written reason |
| `/api/hod/reports/` | GET | HOD | Generate reports (enrollment, faculty-load, student-progress) by semester/department; supports `?format=csv` |
| `/api/hod/audit-logs/` | GET | HOD | Paginated, filterable view of `AuditLog` |
| `/api/notifications/` | GET | Any | List own notifications |
| `/api/notifications/{id}/read/` | PATCH | Any | Mark a notification as read |
| `/api/health/` | GET | Public | Liveness probe returning `{"status":"ok"}` |

---

## 3. Behavioural Deviations

| SRS Requirement | Implemented Behaviour | Reason |
|---|---|---|
| Faculty approval is binary (approve / reject) | Added "Activate / Deactivate" toggle for already-approved faculty | Allows temporary suspension without deleting the account |
| SRS allowed direct enrollment by HOD | Implemented as "override" with mandatory reason field | Adds accountability; satisfies audit requirements |
| No mention of capacity enforcement | `CourseOffering.capacity` enforced at enrolment time; HOD override bypasses the check | Needed for real-world scheduling constraints |
| SRS silent on semester lifecycle | `Semester.status` drives enrollment eligibility: only `OPEN` semesters accept new requests | Prevents stale-semester enrollments |
| SRS had no mention of CGPA gating | `Course.minimum_cgpa` optionally gates student eligibility | Common institutional requirement; HOD can override |

---

## 4. Security Additions (beyond SRS scope)

- JWT-based stateless authentication (SRS implied session cookies)
- Token blacklisting on logout / refresh rotation
- Per-endpoint `permission_classes` explicit on every view
- Rate limiting on `/api/auth/login/` and `/api/auth/register/` (100/min and 60/min)
- `AuditLog` written for all sensitive HOD and faculty actions
- CORS restricted to explicitly configured origins; no wildcard in production
- `SECURE_PROXY_SSL_HEADER`, `HSTS`, secure cookies — all env-driven

---

*Last updated: 2026-10-29*

