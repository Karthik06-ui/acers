// tests/e2e/smoke.spec.js
// Playwright smoke tests for SEAP-CES
// Covers: register, login per role, faculty approval flow,
//         enrollment request → approve → Active, withdrawal, HOD approves faculty.
//
// Preconditions:
//   - Backend running on http://localhost:8000
//   - Frontend running on http://localhost:5173
//   - Seeded HOD: hod@seap.edu / HodPass@123 (run `python manage.py create_hod`)
//   - Tests create their own Student/Faculty users via the API.

const { test, expect } = require('@playwright/test');

const API = 'http://localhost:8000/api';
const TS  = Date.now(); // unique suffix per run

// ── helpers ──────────────────────────────────────────────────────────────────

async function apiPost(endpoint, body) {
  const res = await fetch(`${API}${endpoint}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  return res.json();
}

async function apiPostAuth(endpoint, token, body = {}) {
  const res = await fetch(`${API}${endpoint}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify(body),
  });
  return res.json();
}

async function apiGet(endpoint, token) {
  const res = await fetch(`${API}${endpoint}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  return res.json();
}

async function login(email, password) {
  const d = await apiPost('/auth/login/', { email, password });
  return d.access;
}

async function hodLogin() {
  return login('hod@seap.edu', 'HodPass@123');
}

// ── 01 Student Registration ───────────────────────────────────────────────────

test('01 - student can register and see pending/dashboard page', async ({ page }) => {
  const email = `smoke_stu_${TS}@test.com`;
  await page.goto('/register/student');
  await page.fill('[name="email"], #email, input[type="email"]', email);
  await page.fill('[name="password"], #password, input[type="password"]', 'Pass@1234');
  await page.fill('[name="name"], #name, input[placeholder*="name" i], input[placeholder*="Name" i]', 'Smoke Student');
  await page.fill('[name="roll_no"], #roll_no, input[placeholder*="roll" i]', `ROLL${TS}`);
  await page.click('button[type="submit"], button:has-text("Register")');
  // After registration, should redirect to login or dashboard
  await expect(page).toHaveURL(/login|student|pending/, { timeout: 8000 });
});

// ── 02 Faculty Registration ───────────────────────────────────────────────────

test('02 - faculty can register and sees pending approval page', async ({ page }) => {
  const email = `smoke_fac_${TS}@test.com`;
  await page.goto('/register/faculty');
  await page.fill('[name="email"], #email, input[type="email"]', email);
  await page.fill('[name="password"], #password, input[type="password"]', 'Pass@1234');
  await page.fill('[name="name"], #name, input[placeholder*="name" i]', 'Smoke Faculty');
  await page.click('button[type="submit"], button:has-text("Register")');
  await expect(page).toHaveURL(/pending|login/, { timeout: 8000 });
});

// ── 03 Student Login ──────────────────────────────────────────────────────────

test('03 - registered student can log in and reach dashboard', async ({ page }) => {
  // Create student via API
  const email = `smoke_login_stu_${TS}@test.com`;
  await apiPost('/auth/register/student/', {
    email, password: 'Pass@1234', name: 'Login Student', roll_no: `LG${TS}`,
  });

  await page.goto('/login');
  await page.fill('input[type="email"], input[name="email"]', email);
  await page.fill('input[type="password"], input[name="password"]', 'Pass@1234');
  await page.click('button[type="submit"], button:has-text("Login"), button:has-text("Sign in")');
  await expect(page).toHaveURL('/student', { timeout: 10000 });
  await expect(page.locator('text=Dashboard, text=Student Portal')).toBeVisible({ timeout: 5000 });
});

// ── 04 Faculty Login (approved) ───────────────────────────────────────────────

test('04 - approved faculty can log in and reach faculty dashboard', async ({ page }) => {
  // Register then approve via HOD API
  const email = `smoke_appr_fac_${TS}@test.com`;
  await apiPost('/auth/register/faculty/', { email, password: 'Pass@1234', name: 'Approved Faculty' });

  // Approve via HOD token
  const hodToken = await hodLogin();
  const facList  = await apiGet('/auth/hod/faculty/?status=pending&page_size=100', hodToken);
  const fac = (facList.results || facList).find(f => (f.user?.email || f.email) === email);
  if (fac) await apiPostAuth(`/auth/hod/faculty/${fac.id}/approve/`, hodToken);

  await page.goto('/login');
  await page.fill('input[type="email"], input[name="email"]', email);
  await page.fill('input[type="password"], input[name="password"]', 'Pass@1234');
  await page.click('button[type="submit"], button:has-text("Login"), button:has-text("Sign in")');
  await expect(page).toHaveURL('/faculty', { timeout: 10000 });
});

// ── 05 HOD Login ──────────────────────────────────────────────────────────────

test('05 - HOD can log in and reach HOD dashboard', async ({ page }) => {
  await page.goto('/login');
  await page.fill('input[type="email"], input[name="email"]', 'hod@seap.edu');
  await page.fill('input[type="password"], input[name="password"]', 'HodPass@123');
  await page.click('button[type="submit"], button:has-text("Login"), button:has-text("Sign in")');
  await expect(page).toHaveURL('/hod', { timeout: 10000 });
  await expect(page.locator('text=HOD Administration, h2:has-text("HOD")')).toBeVisible({ timeout: 5000 });
});

// ── 06 HOD approves faculty via UI ───────────────────────────────────────────

test('06 - HOD approves pending faculty via UI', async ({ page }) => {
  const email = `smoke_ui_fac_${TS}@test.com`;
  await apiPost('/auth/register/faculty/', { email, password: 'Pass@1234', name: 'UI Faculty' });

  // Log in as HOD
  await page.goto('/login');
  await page.fill('input[type="email"], input[name="email"]', 'hod@seap.edu');
  await page.fill('input[type="password"], input[name="password"]', 'HodPass@123');
  await page.click('button[type="submit"], button:has-text("Login"), button:has-text("Sign in")');
  await expect(page).toHaveURL('/hod', { timeout: 10000 });

  // Navigate to Faculty page
  await page.click('a[href="/hod/faculty"], text=Faculty');
  await expect(page).toHaveURL('/hod/faculty', { timeout: 5000 });

  // Pending tab should be active by default
  // Find the newly registered faculty and approve
  await expect(page.locator(`text=${email}, text=UI Faculty`)).toBeVisible({ timeout: 6000 });
  const approveBtn = page.locator('button:has-text("Approve")').first();
  await approveBtn.click();
  // Verify success toast or page refresh
  await expect(page.locator('text=approved, text=Approved, .toast, [role="alert"]')).toBeVisible({ timeout: 5000 });
});

// ── 07 Enrollment request → faculty approves → student sees Active ─────────────

test('07 - enrollment request flow: student requests, faculty approves, status is Active', async ({ page }) => {
  // Setup via API: student + faculty + semester + course + offering
  const stuEmail = `smoke_enr_stu_${TS}@test.com`;
  const facEmail = `smoke_enr_fac_${TS}@test.com`;

  await apiPost('/auth/register/student/', { email: stuEmail, password: 'Pass@1234', name: 'Enroll Student', roll_no: `EN${TS}` });
  await apiPost('/auth/register/faculty/', { email: facEmail, password: 'Pass@1234', name: 'Enroll Faculty' });

  const hodToken = await hodLogin();
  const facList  = await apiGet('/auth/hod/faculty/?status=pending&page_size=100', hodToken);
  const fac = (facList.results || facList).find(f => (f.user?.email || f.email) === facEmail);
  if (fac) await apiPostAuth(`/auth/hod/faculty/${fac.id}/approve/`, hodToken);

  // Fetch first open offering (assumes seeded data has at least one)
  const offerings = await apiGet('/academics/offerings/?status=Open&page_size=5', hodToken);
  const firstOffering = (offerings.results || offerings)[0];

  if (!firstOffering) {
    test.skip(true, 'No open offerings found — seed data needed for this test');
    return;
  }

  // Student submits enrollment request
  const stuToken = await login(stuEmail, 'Pass@1234');
  const reqData  = await apiPostAuth('/enrollments/requests/', stuToken, { offering: firstOffering.id });
  expect(reqData.id).toBeTruthy();

  // Faculty approves via API (UI approval tested in UC-14 manually)
  const facToken = await login(facEmail, 'Pass@1234');
  await apiPostAuth(`/faculty/requests/${reqData.id}/approve/`, facToken, { remarks: 'Approved by smoke test' });

  // Student verifies enrollment is Active
  const enrollments = await apiGet('/enrollments/my/?status=Active', stuToken);
  const active = (enrollments.results || enrollments).find(e => e.offering?.id === firstOffering.id);
  expect(active).toBeTruthy();
  expect(active.status).toBe('Active');
});

// ── 08 Withdrawal flow ────────────────────────────────────────────────────────

test('08 - student can withdraw an active enrollment', async ({ page }) => {
  const stuEmail = `smoke_wdr_stu_${TS}@test.com`;
  const facEmail = `smoke_wdr_fac_${TS}@test.com`;

  await apiPost('/auth/register/student/', { email: stuEmail, password: 'Pass@1234', name: 'Withdraw Student', roll_no: `WD${TS}` });
  await apiPost('/auth/register/faculty/', { email: facEmail, password: 'Pass@1234', name: 'Withdraw Faculty' });

  const hodToken = await hodLogin();
  const facList  = await apiGet('/auth/hod/faculty/?status=pending&page_size=100', hodToken);
  const fac = (facList.results || facList).find(f => (f.user?.email || f.email) === facEmail);
  if (fac) await apiPostAuth(`/auth/hod/faculty/${fac.id}/approve/`, hodToken);

  const offerings = await apiGet('/academics/offerings/?status=Open&page_size=5', hodToken);
  const firstOffering = (offerings.results || offerings)[0];
  if (!firstOffering) { test.skip(true, 'No open offerings found'); return; }

  const stuToken = await login(stuEmail, 'Pass@1234');
  const facToken = await login(facEmail, 'Pass@1234');

  const reqData = await apiPostAuth('/enrollments/requests/', stuToken, { offering: firstOffering.id });
  await apiPostAuth(`/faculty/requests/${reqData.id}/approve/`, facToken, { remarks: 'ok' });

  const enrollments = await apiGet('/enrollments/my/?status=Active', stuToken);
  const enroll = (enrollments.results || enrollments).find(e => e.offering?.id === firstOffering.id);
  expect(enroll).toBeTruthy();

  // Withdraw
  const wdrResult = await apiPostAuth(`/enrollments/${enroll.id}/withdraw/`, stuToken);
  expect(wdrResult.status).toBe('Withdrawn');
});

// ── 09 HOD full journey: pending → active faculty → teaching course ────────────

test('09 - HOD approves faculty, creates offering, student enrolls, audit log shows actions', async () => {
  const facEmail = `smoke_full_fac_${TS}@test.com`;
  const stuEmail = `smoke_full_stu_${TS}@test.com`;

  // Register faculty + student
  await apiPost('/auth/register/faculty/', { email: facEmail, password: 'Pass@1234', name: 'Full Flow Faculty' });
  await apiPost('/auth/register/student/', { email: stuEmail, password: 'Pass@1234', name: 'Full Flow Student', roll_no: `FF${TS}` });

  const hodToken = await hodLogin();

  // HOD approves faculty
  const facList = await apiGet('/auth/hod/faculty/?status=pending&page_size=100', hodToken);
  const fac = (facList.results || facList).find(f => (f.user?.email || f.email) === facEmail);
  expect(fac, 'Faculty should be in pending list').toBeTruthy();
  const approveResp = await apiPostAuth(`/auth/hod/faculty/${fac.id}/approve/`, hodToken);
  expect(approveResp.detail).toMatch(/approved/i);

  // Get an open course
  const courses = await apiGet('/academics/courses/?status=Open&page_size=5', hodToken);
  const course = (courses.results || courses)[0];
  if (!course) { console.log('Skip: no open courses for offering creation'); return; }

  // Get an open semester
  const sems = await apiGet('/academics/semesters/?status=Open&page_size=5', hodToken);
  const sem = (sems.results || sems)[0];
  if (!sem) { console.log('Skip: no open semesters'); return; }

  // HOD creates offering and assigns faculty
  const offering = await apiPostAuth('/academics/offerings/', hodToken, {
    course: course.id, faculty: fac.id, semester: sem.id, capacity: 5, status: 'Open',
  });
  expect(offering.id, 'Offering should be created').toBeTruthy();

  // Student submits enrollment request
  const stuToken = await login(stuEmail, 'Pass@1234');
  const req = await apiPostAuth('/enrollments/requests/', stuToken, { offering: offering.id });
  expect(req.id).toBeTruthy();

  // Faculty approves
  const facToken = await login(facEmail, 'Pass@1234');
  const enrollment = await apiPostAuth(`/faculty/requests/${req.id}/approve/`, facToken, { remarks: 'Full flow approved' });
  expect(enrollment.status).toBe('Active');

  // HOD checks audit log for APPROVE_FACULTY and APPROVE_REQUEST
  const auditLog = await apiGet('/hod/audit-logs/?page_size=50', hodToken);
  const entries = auditLog.results || auditLog;
  const hasApprove    = entries.some(e => e.action === 'APPROVE_FACULTY');
  const hasEnrollAppr = entries.some(e => e.action === 'APPROVE_REQUEST');
  expect(hasApprove, 'APPROVE_FACULTY must be in audit log').toBe(true);
  expect(hasEnrollAppr, 'APPROVE_REQUEST must be in audit log').toBe(true);
});

