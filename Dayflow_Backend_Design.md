# Dayflow HRMS — Backend Design & Implementation Plan

## 0. Quick Analysis of the PRD

Stripping the doc down to what actually needs backend logic, six modules:

1. **Auth** — signup, email verification, login, roles (Employee / Admin-HR)
2. **Profile** — view/edit employee details, docs, photo
3. **Attendance** — check-in/out, daily/weekly view, status
4. **Leave** — apply, approve/reject, status tracking
5. **Payroll** — read-only for employee, editable by admin
6. **Dashboard/Reports** — aggregated views, notifications (mentioned once, low detail — treated as thin wrapper endpoints over the above, not a separate engine)

No mention of multi-tenancy, multiple companies, shift management, or biometric integration — so I'm **not** building for those. Keep it to one org, two roles, straightforward CRUD + workflow states.

**Suggested stack** (swap freely, design is stack-agnostic): Node.js/Express or NestJS + PostgreSQL + JWT auth. Postgres because the data is inherently relational (users→employees→attendance/leave/payroll, all FK-heavy with joins for dashboards).

---

## 1. Database Schema

### 1.1 `users`
| Column | Type | Notes |
|---|---|---|
| id | UUID PK | |
| employee_id | VARCHAR UNIQUE | e.g. `EMP-1024` |
| email | VARCHAR UNIQUE | |
| password_hash | VARCHAR | bcrypt |
| role | ENUM('employee','admin') | |
| is_verified | BOOLEAN | default false |
| verification_token | VARCHAR NULLABLE | |
| created_at, updated_at | TIMESTAMP | |

### 1.2 `employee_profiles`
| Column | Type | Notes |
|---|---|---|
| id | UUID PK | |
| user_id | UUID FK → users.id | 1:1 |
| full_name | VARCHAR | |
| phone | VARCHAR | editable by employee |
| address | TEXT | editable by employee |
| profile_picture_url | VARCHAR | editable by employee |
| designation | VARCHAR | admin-only edit |
| department | VARCHAR | admin-only edit |
| date_of_joining | DATE | admin-only edit |
| employment_type | ENUM('full-time','contract','intern') | admin-only edit |
| created_at, updated_at | TIMESTAMP | |

### 1.3 `documents`
| Column | Type | Notes |
|---|---|---|
| id | UUID PK | |
| user_id | UUID FK | |
| doc_type | VARCHAR | e.g. "ID Proof", "Offer Letter" |
| file_url | VARCHAR | stored in S3/blob, URL only in DB |
| uploaded_at | TIMESTAMP | |

### 1.4 `attendance`
| Column | Type | Notes |
|---|---|---|
| id | UUID PK | |
| user_id | UUID FK | |
| date | DATE | unique with user_id |
| check_in_time | TIMESTAMP NULLABLE | |
| check_out_time | TIMESTAMP NULLABLE | |
| status | ENUM('present','absent','half-day','leave') | derived/set |
| created_at, updated_at | TIMESTAMP | |

Unique constraint: `(user_id, date)` — one row per user per day.

### 1.5 `leave_requests`
| Column | Type | Notes |
|---|---|---|
| id | UUID PK | |
| user_id | UUID FK | applicant |
| leave_type | ENUM('paid','sick','unpaid') | |
| start_date | DATE | |
| end_date | DATE | |
| remarks | TEXT NULLABLE | from employee |
| status | ENUM('pending','approved','rejected') | default pending |
| reviewed_by | UUID FK → users.id NULLABLE | admin who acted |
| admin_comment | TEXT NULLABLE | |
| created_at, updated_at | TIMESTAMP | |

### 1.6 `salary_structures`
| Column | Type | Notes |
|---|---|---|
| id | UUID PK | |
| user_id | UUID FK | |
| basic | DECIMAL | |
| hra | DECIMAL | |
| allowances | DECIMAL | |
| deductions | DECIMAL | |
| net_salary | DECIMAL | computed on save |
| effective_from | DATE | supports salary history |
| updated_by | UUID FK → users.id | admin |
| created_at | TIMESTAMP | |

Query "current salary" as the row with the latest `effective_from <= today`.

### 1.7 `notifications` (thin — supports "alerts" mention)
| Column | Type | Notes |
|---|---|---|
| id | UUID PK | |
| user_id | UUID FK | recipient |
| type | VARCHAR | e.g. "leave_approved" |
| message | TEXT | |
| is_read | BOOLEAN | default false |
| created_at | TIMESTAMP | |

**Relationships summary:** `users` 1—1 `employee_profiles`, 1—many `documents`/`attendance`/`leave_requests`/`salary_structures`/`notifications`. Nothing more complex needed — no need for a separate "departments" or "roles" table given only two fixed roles.

---

## 2. API Endpoints

Base path: `/api/v1`. Auth via `Authorization: Bearer <JWT>` except signup/login/verify. Standard error shape used everywhere:
```json
{ "success": false, "error": { "code": "STRING_CODE", "message": "human readable" } }
```
Standard success shape:
```json
{ "success": true, "data": { ... } }
```

### 2.1 Auth

**POST /auth/signup**
Request:
```json
{ "employee_id": "EMP-1024", "email": "a@co.com", "password": "Str0ng!Pass", "role": "employee" }
```
Response `201`:
```json
{ "success": true, "data": { "user_id": "uuid", "message": "Verification email sent" } }
```
Rules: password ≥8 chars, 1 upper, 1 number, 1 symbol. Store `verification_token`, send email, `is_verified=false`.

**GET /auth/verify-email?token=xyz**
Response `200`: `{ "success": true, "data": { "message": "Email verified" } }`

**POST /auth/login**
Request: `{ "email": "a@co.com", "password": "Str0ng!Pass" }`
Response `200`:
```json
{ "success": true, "data": {
  "access_token": "jwt...", "refresh_token": "jwt...",
  "user": { "id": "uuid", "role": "employee", "full_name": "Asha K", "employee_id": "EMP-1024" }
}}
```
`401` on bad credentials, `403` if `is_verified=false`.

**POST /auth/refresh** → new access token from refresh token.
**POST /auth/logout** → invalidate refresh token (blacklist or DB row).

### 2.2 Dashboard

**GET /dashboard** (role-aware, single endpoint, backend branches on JWT role)
Employee response:
```json
{ "success": true, "data": {
  "profile_summary": { "full_name": "Asha K", "designation": "SDE-2" },
  "today_attendance": { "status": "present", "check_in_time": "09:02" },
  "pending_leaves": 1,
  "recent_alerts": [{ "type": "leave_approved", "message": "Your leave was approved" }]
}}
```
Admin response:
```json
{ "success": true, "data": {
  "employee_count": 42,
  "today_attendance_summary": { "present": 38, "absent": 2, "leave": 2 },
  "pending_leave_approvals": 5
}}
```

### 2.3 Profile

**GET /profile/me** → full profile of logged-in user (joins `users`+`employee_profiles`+`documents`).

**PATCH /profile/me** (employee — limited fields)
Request: `{ "phone": "9999999999", "address": "New addr", "profile_picture_url": "https://..." }`
Response `200`: updated profile object.

**GET /profile/:userId** (admin only)
**PATCH /profile/:userId** (admin — all fields incl. designation, department, employment_type)

**POST /profile/:userId/documents** (multipart upload) → `{ doc_type, file_url }`
**GET /profile/:userId/documents** → list

### 2.4 Attendance

**POST /attendance/check-in** → creates/updates today's row, sets `check_in_time`, `status='present'`. `409` if already checked in.

**POST /attendance/check-out** → sets `check_out_time`. `400` if not checked in yet.

**GET /attendance/me?view=daily|weekly&date=2026-08-22**
Response:
```json
{ "success": true, "data": {
  "view": "weekly",
  "records": [
    { "date": "2026-08-18", "status": "present", "check_in_time": "09:01", "check_out_time": "18:05" },
    { "date": "2026-08-19", "status": "leave", "check_in_time": null, "check_out_time": null }
  ]
}}
```

**GET /attendance/:userId?view=&date=** (admin, same shape)

**GET /attendance?date=2026-08-22** (admin — all employees for a given day, for the admin dashboard table)

### 2.5 Leave

**POST /leave** (employee)
Request: `{ "leave_type": "sick", "start_date": "2026-08-25", "end_date": "2026-08-26", "remarks": "fever" }`
Response `201`: `{ "success": true, "data": { "id": "uuid", "status": "pending" } }`
Validation: `end_date >= start_date`, no overlapping pending/approved request for same user.

**GET /leave/me?status=** → list own requests.

**GET /leave?status=pending&user_id=** (admin) → list all/filtered requests, paginated.

**PATCH /leave/:id/decision** (admin)
Request: `{ "decision": "approved", "admin_comment": "Approved, get well" }`
Response `200`: updated request. Side-effects: set `reviewed_by`, insert `notifications` row for applicant, and if approved, backfill matching `attendance` rows for that date range with `status='leave'`.

### 2.6 Payroll

**GET /payroll/me** (employee, read-only)
```json
{ "success": true, "data": {
  "basic": 50000, "hra": 20000, "allowances": 5000, "deductions": 3000,
  "net_salary": 72000, "effective_from": "2026-04-01"
}}
```

**GET /payroll/:userId** (admin)
**PUT /payroll/:userId** (admin — creates a new salary_structures row, doesn't mutate old one, preserves history)
Request: `{ "basic": 55000, "hra": 22000, "allowances": 5000, "deductions": 3000, "effective_from": "2026-09-01" }`

**GET /payroll/:userId/history** (admin) → list of past structures.

### 2.7 Reports (thin, per "Analytics & reports" line)

**GET /reports/attendance?from=&to=&user_id=** → CSV/JSON summary
**GET /reports/salary-slip/:userId?month=2026-08** → single-month slip (PDF generation is a separate concern from this API layer; endpoint just returns the data payload for the frontend/PDF renderer)

---

## 3. Cross-Cutting Backend Concerns

- **AuthZ middleware:** two guards — `requireAuth` (valid JWT) and `requireRole('admin')`. Every admin-only route above gets both.
- **Ownership check:** for `/profile/me`, `/attendance/me`, `/leave/me`, `/payroll/me` routes, `userId` is taken from the JWT, never from the request body/params — prevents an employee from passing someone else's ID.
- **Validation:** use a schema validator (Zod/Joi) at the route layer before hitting the DB, matching the rules above (password strength, date ranges, enum values).
- **Password security:** bcrypt with cost factor 10-12, never log/return password_hash.
- **Notifications:** written synchronously on state-changing events (leave decision, salary update) — no need for a queue at this scale.

---

## 4. Step-by-Step Build Plan

| Step | What you build | Outcome / Definition of Done |
|---|---|---|
| **1. Project & DB setup** | Init backend project, connect Postgres, run migrations for all 7 tables above | Server boots, tables exist, can insert/query manually |
| **2. Auth module** | Signup, email verify, login, JWT issue/refresh, auth middleware | Can create a user, verify email, log in, get a valid JWT, blocked without it |
| **3. Profile module** | `/profile/me` GET/PATCH, admin profile GET/PATCH, document upload | Employee can view/edit own limited fields; admin can edit anyone; frontend Profile page fully data-driven |
| **4. Attendance module** | Check-in/out, daily/weekly view, admin all-employee view | Check-in creates a row, check-out closes it, weekly view returns 7 correctly-dated rows |
| **5. Leave module** | Apply, list-mine, admin list/filter, approve/reject with side-effects | Employee can apply and see status change live after admin acts; attendance auto-updates on approval |
| **6. Payroll module** | Employee read view, admin edit + history | Employee sees current salary only; admin can revise and history is preserved, not overwritten |
| **7. Dashboard & notifications** | Aggregation endpoint per role, notifications table wired into leave/payroll actions | Dashboard cards populate from real joined data; unread alerts show on employee dashboard |
| **8. Reports** | Attendance summary export, salary slip data endpoint | Admin can pull a date-ranged attendance report; salary slip payload matches a given month |
| **9. Hardening** | Rate-limit auth routes, input validation everywhere, error-code consistency, seed/test data | Postman/integration test suite green; consistent success/error envelope across all endpoints |

Each step is independently testable via Postman/curl before the frontend team wires it up — so the frontend can start integrating against Step 2 while Steps 3+ are still in progress, as long as the response shapes above are held fixed.
