# Dayflow HRMS — Detailed Implementation Plan

Status: Planning baseline, implementation not started  
Prepared from: the five-page requirements PDF, all ten supplied screenshots, and the linked Excalidraw board preview  
Target stack: Next.js frontend with shadcn/ui, Node.js + TypeScript backend, Neon PostgreSQL database  
Primary objective: deliver a secure, auditable HRMS covering organization onboarding, employee records, attendance, time off, and salary/payroll visibility without losing requirements embedded in the visual annotations.

---

## 1. Executive decision

Dayflow should be built as a multi-tenant modular monolith, not as microservices.

- The frontend will be a Next.js App Router application using shadcn/ui as the component-system foundation.
- The backend will be a separate NestJS REST API running on Node.js and TypeScript.
- Neon PostgreSQL will be the system of record.
- Prisma will define the schema, migrations, and type-safe database access.
- Uploaded logos, avatars, resumes, certificates, and leave attachments will live in S3-compatible object storage. Neon stores their metadata and access rules.
- Authentication will use backend-issued short-lived access sessions and rotated refresh sessions in Secure, HttpOnly cookies.
- Authorization will be enforced by organization, role, resource ownership, and field-level policy.
- The first production release will be a modular monolith with clear Auth, Organization, Employee, Attendance, Leave, Payroll, File, and Audit modules.
- Every material HR change will be auditable. Salary and private employee data will receive the strictest permissions.

This architecture keeps the first release understandable and testable while leaving clean boundaries for future extraction if scale ever justifies it.

---

## 2. Source inventory and extracted intent

### 2.1 Source artifacts reviewed

| Source | Content discovered | Planning impact |
|---|---|---|
| resources/Dayflow - Human Resource Management System.pdf, pages 1–5 | Scope, user classes, authentication, dashboards, profiles, attendance, leave, payroll, future enhancements | Defines the baseline product scope |
| resources/image copy 9.png | Sign-in, company sign-up, logo upload, generated Login ID, admin-created employee accounts, first-time generated password | Defines account onboarding and Login ID behavior |
| resources/image copy 8.png | Post-login employee directory, employee cards, presence indicator, avatar menu, check-in/check-out controls | Defines the main shell, directory, and live attendance controls |
| resources/image copy 7.png | Admin profile, resume/private/salary tabs, salary component layout, PF and tax fields | Defines profile tabs and salary configuration |
| resources/image copy 6.png | Private information fields, bank/statutory fields, salary calculation notes | Defines sensitive employee data and salary engine rules |
| resources/image copy 5.png | Attendance defaults, work time and breaks, payroll dependency, payable-day deductions | Defines attendance-to-payroll behavior |
| resources/image copy 4.png | Admin daily attendance list, employee search, date navigation, work and extra hours | Defines admin attendance UI |
| resources/image copy 3.png | Employee monthly attendance, counts, date navigation, check-in/out, work and extra hours | Defines employee attendance UI |
| resources/image copy 2.png | Leave request modal, leave types, date range, allocation, attachment, submit/discard | Defines leave request capture |
| resources/image copy.png | Employee leave balances, annual calendar, holidays, status legend | Defines the employee time-off calendar |
| resources/image.png | Admin time-off list, search, approval/rejection actions, Allocation tab | Defines leave approval and allocation administration |
| Linked Excalidraw preview | Confirms the screenshots are sections of one product flow board | Used as a completeness cross-check |

### 2.2 Requirement precedence

When sources disagree, implementation must not silently pick whichever is easiest. Use this order:

1. A signed product decision recorded during Stage 0.
2. A specific annotated visual behavior.
3. The functional requirement PDF.
4. A safe default documented in this plan.

### 2.3 Conflicts that require explicit product sign-off

| Conflict | Safe proposed interpretation |
|---|---|
| PDF says users can sign up with Employee ID/email/password/role; screenshot says normal users cannot register | Public sign-up creates a company and its first Admin account only. Employees and additional HR/Admin users are created or invited by an authorized Admin. No public role selector is exposed. |
| PDF says Employee ID is entered at sign-up; screenshot says Login ID is generated | Generate Login ID and immutable employee code server-side. Email remains an alternate sign-in identifier. |
| PDF says employees view salary structure/payroll; screenshot says Salary Info tab is admin-only | Employees may see only their own finalized payroll summary. Salary configuration, formulas, and editable structure remain Admin-only. Downloadable salary slips remain a future enhancement unless pulled into scope. |
| PDF asks for an employee dashboard; screenshot says users land on employee cards | Admin/HR lands on Employees. Employee lands on a role-specific dashboard with quick actions; an employee directory may be available with public workplace fields only. |
| PDF asks for daily and weekly attendance; screenshot shows monthly employee view and daily admin view | Support employee month and week views plus admin day and date-range views. |
| PDF describes Admin and HR Officer together; screenshots mention Admin, HR, and Time-Off Officer | Start with Admin, HR Officer, and Employee. Represent fine-grained permissions internally so a Time-Off Officer preset can be enabled without schema redesign. |
| PDF puts salary slips and attendance reports in future enhancements; screenshot requires attendance-driven payslip computation | Implement calculation-ready payroll records and attendance-derived payable days now. Defer downloadable payslip documents and analytics dashboards. |
| Screenshot says generated first password; PDF requires email verification | Prefer a one-time activation link that lets the user set a password. If a temporary password is retained, it must expire and force a change at first login. Email ownership must still be verified. |
| Salary screenshot labels Fixed Allowance as the wage remainder, but the displayed component example does not visibly reconcile to the INR 50,000 wage | Treat all displayed salary numbers as illustrative until the payroll owner supplies a reconciled golden calculation. Stage 11 cannot pass using an internally inconsistent mock as the accounting rule. |
| Attendance note refers to an employee “working source” based on assigned attendance, without defining working source | Interpret this as the employee’s effective work schedule plus captured attendance events. Confirm whether an Odoo-style “working hours source” concept is required. |

Stage 0 does not pass until these interpretations are accepted or replaced.

---

## 3. Product scope

### 3.1 Release 1 scope

1. Company registration and initial Admin activation.
2. Secure sign-in with email or generated Login ID.
3. Admin-managed employee and HR account provisioning.
4. Role-based navigation and resource/field authorization.
5. Employee directory and live work-status indicators.
6. Employee profile, private information, bank/statutory data, resume, skills, certifications, avatar, and documents.
7. Work schedules, shifts, breaks, weekends, company holidays, and location holidays.
8. Check-in/check-out and optional break tracking.
9. Employee attendance month/week views and Admin daily/range views.
10. Attendance correction/approval flow because the PDF assigns attendance approval responsibility to Admin/HR.
11. Leave types: Paid Time Off, Sick Leave, and Unpaid Leave.
12. Leave policies, balances, allocations, annual calendar, public holidays, request attachments, and approval/rejection comments.
13. Versioned salary structures with fixed and percentage components.
14. Employer/employee PF and professional-tax configuration.
15. Attendance-derived payable days and payroll calculation previews/records.
16. Employee read-only finalized payroll summary, subject to Stage 0 approval.
17. Audit trail for security, employee, attendance, leave, and payroll actions.

### 3.2 Explicitly deferred

- General email and in-app HR notifications beyond identity, security, and account activation messages.
- Analytics dashboards.
- Downloadable PDF salary slips.
- Bulk payroll bank files or payment execution.
- Recruitment, performance reviews, expense management, and asset management.
- Native mobile applications.
- Biometric device integration, GPS enforcement, or IP-geofenced attendance.
- Government filing automation.
- Odoo synchronization or an Odoo add-on. The Odoo logo/example and repository name do not by themselves define an integration requirement.
- Complex workflow builders.
- Cross-company consolidated reporting.

Deferred items must still have clean extension points, but they must not delay Release 1.

### 3.3 Product assumptions

- The product may serve more than one company, so every business row is organization-scoped.
- India is the initial payroll context because the screens specify INR, PF, PAN, UAN, IFSC, and Professional Tax.
- Each organization has a default timezone and currency; Asia/Kolkata and INR are initial defaults, not hard-coded global constants.
- A local calendar date is distinct from an instant. Leave uses date values; clock events use UTC timestamps and retain organization timezone context.
- Employees can have one active primary work schedule and one active salary assignment at a time.
- Payroll calculations are deterministic snapshots. Later profile or policy edits do not mutate finalized periods.

---

## 4. Personas and authorization matrix

### 4.1 Roles

- Admin: organization owner-level HR administration, user/role management, all employee fields, leave/attendance approvals, salary configuration, payroll finalization, and audit access.
- HR Officer: employee administration, attendance and leave workflows, with salary and security administration disabled by default.
- Employee: own profile/private-data maintenance for allowed fields, own attendance, own leave, own finalized payroll summary, and limited employee directory access.

### 4.2 Minimum authorization matrix

| Capability | Admin | HR Officer | Employee |
|---|---:|---:|---:|
| Manage organization settings/logo | Yes | View | No |
| Create/deactivate users | Yes | Configurable | No |
| Assign roles | Yes | No | No |
| View employee workplace directory | Yes | Yes | Limited public fields |
| Edit job details | Yes | Yes | No |
| Edit address, phone, avatar | Yes | Yes | Own only |
| View private/bank/statutory fields | Yes | Configurable | Own only |
| View/edit salary structure | Yes | No by default | No |
| View finalized payroll summary | All | Configurable | Own only |
| Clock in/out | Own account | Own account | Own account |
| View attendance | All | All | Own only |
| Correct/approve attendance | Yes | Yes | Request own correction |
| Configure leave types/policies | Yes | Configurable | No |
| Allocate leave | Yes | Yes | No |
| Submit leave | Own or on behalf | Own or on behalf | Own |
| Approve/reject leave | Yes | Yes | No |
| View audit log | Yes | Limited HR events | No |

Authorization tests must verify both endpoint access and field redaction. Hiding a tab in the browser is not authorization.

---

## 5. Detailed functional requirements

### 5.1 Organization and identity

#### ORG-001 — Company registration

- Capture company name, initial Admin name, work email, phone, password, password confirmation, and optional company logo.
- Normalize company name and create a unique organization slug.
- Verify the initial Admin email before normal access.
- Reject duplicate organization/email combinations without leaking unrelated account existence.
- Record terms/privacy acceptance if legal text is introduced.

#### ORG-002 — Organization configuration

- Store legal/display name, logo, timezone, currency, locale, default work week, default shift, fiscal/payroll settings, and Login ID company prefix.
- Allow only Admin to modify security-sensitive settings.

#### AUTH-001 — Generated Login ID

- Generate on the server inside a transaction.
- Proposed format: COMPANY_PREFIX + NAME_PREFIX + JOIN_YEAR + FOUR_DIGIT_SEQUENCE.
- Example intent from screenshot: OI + JODO + 2022 + 0001.
- Company prefix should be configurable at onboarding and immutable after the first employee unless an audited migration is run.
- Name prefix must be deterministic and transliteration/duplicate behavior must be defined.
- Sequence is unique per organization and joining year.
- Store generated Login ID separately from immutable internal UUID.
- Enforce a database unique constraint on organization_id + login_id.

#### AUTH-002 — Employee provisioning

- Admin creates employee record and account together or creates a profile in Draft state and sends activation later.
- Role is chosen from roles the creator is allowed to grant.
- Activation token is single-use, hashed at rest, and expires.
- The user sets a password and verifies email through the activation flow.
- Resend invalidates previous unused activation tokens.

#### AUTH-003 — Sign-in and sessions

- Accept email or Login ID plus password.
- Return a generic incorrect-credentials error.
- Apply rate limits by account key and IP.
- Use Argon2id password hashing with parameters benchmarked for the deployment environment.
- Use short-lived access sessions and rotated refresh sessions.
- Store refresh token hashes, device/user-agent metadata, last-used time, and revocation state.
- Cookies must be HttpOnly, Secure in non-local environments, SameSite Lax or stricter, and narrowly scoped.
- Logout revokes the current refresh session; “log out all devices” revokes all sessions.

#### AUTH-004 — Password lifecycle

- Strong password rules, breached-password policy if approved, change password, forgot password, reset password, and forced first-time password change.
- Password reset tokens are single-use, hashed, expiring, and invalidate active sessions after reset.
- Sensitive changes require recent authentication.

#### AUTH-005 — Account states

- Draft, Invited, Active, Suspended, and Deactivated.
- Suspended/deactivated users cannot authenticate or refresh sessions.
- Deactivation preserves historical attendance, leave, payroll, and audit data.

### 5.2 Application shell and dashboards

#### UI-001 — Main shell

- Header/navigation contains Company Logo, Employees, Attendance, Time Off, avatar/presence control, and profile menu.
- Active module is visually clear.
- Avatar menu contains My Profile and Log Out.
- Keyboard navigation, focus behavior, mobile menu behavior, loading states, and error states are defined.

#### DASH-001 — Admin/HR landing

- Default to employee directory.
- Show searchable employee cards with avatar, name, key workplace information, and live status.
- Clicking a card opens a read-only summary first; edit controls appear only to authorized users.
- Search supports name, Login ID, employee code, department, and work email.
- Paginate or cursor-load results; do not fetch the entire organization.

#### DASH-002 — Employee landing

- Quick access to My Profile, Attendance, Leave Requests/Time Off, and Logout.
- Show today’s clock state, leave balance summary, and recent security/HR activity where available.
- Do not expose other employees’ private, contact, bank, salary, or attendance details.

#### DASH-003 — Live work status

- Green: checked in and not checked out.
- Leave icon: an approved leave covers the current local date.
- Yellow: expected to work, not on approved leave, and no valid check-in after the configured absence threshold.
- Red in the header means the current user is not checked in; green means checked in.
- Non-working day and future/unknown states need a neutral treatment rather than being labeled absent.
- Status precedence: approved leave, active attendance, non-working/holiday, absent, unknown.

### 5.3 Employee records and profiles

#### EMP-001 — Core workplace identity

- Profile picture/avatar.
- Full legal name and preferred/display name.
- Login ID and employee code.
- Work email and mobile.
- Company, department, job position, manager, work location, employment status, and date of joining.
- Manager relationship must point to an employee in the same organization and must prevent cycles.

#### EMP-002 — Resume/public profile

- About.
- What I love about my job.
- Interests and hobbies.
- Skills with name and optional proficiency.
- Certifications with name, issuer, issue/expiry dates, credential ID/URL, and document.
- Employees may edit their own resume content; HR/Admin may edit according to policy.

#### EMP-003 — Private information

- Date of birth, residential address, nationality, personal email, gender, marital status, and joining date.
- Bank account holder, masked account number display, bank name, IFSC.
- PAN, UAN, and employee code.
- Encrypt especially sensitive values at application level if infrastructure key management is available.
- Always redact/mask values in logs and list endpoints.

#### EMP-004 — Profile editing

- Employee may edit own address, phone, profile picture, and approved resume fields.
- Admin can edit all employee fields except immutable internal identifiers.
- HR access to bank/statutory/salary fields is permission-controlled.
- Use optimistic concurrency to prevent one editor silently overwriting another.
- Record old/new values in an audit event with sensitive values redacted.

#### EMP-005 — Documents

- Support resume, identity, employment, certification, and other categories.
- Store metadata in PostgreSQL and bytes in object storage.
- Validate size, extension, MIME signature, and organization ownership.
- Use short-lived signed upload/download URLs.
- Leave evidence and profile documents have different permissions.
- Malware scanning is required before a file becomes downloadable in production.

### 5.4 Work calendars and attendance

#### ATT-001 — Work schedule

- Organization defaults and employee-specific assignment.
- Working weekdays, shift start/end, paid/unpaid break duration, grace period, minimum half-day/full-day hours, overtime threshold, and timezone.
- Effective-dated assignments preserve historical calculations.

#### ATT-002 — Holidays

- Organization or location-specific public holidays.
- Holiday name, date, optional/mandatory flag, location, and active status.
- The annual time-off calendar shows applicable holidays.
- The 2026 holidays visible in the sketch—including Republic Day, Independence Day, Gandhi Jayanti, Diwali, New Year, and regional festivals—are demo content, not safe global defaults. Stage 0 must confirm the authoritative company/location holiday list.

#### ATT-003 — Clock state machine

- Valid sequence: Not Clocked In → Clocked In → On Break → Clocked In → Clocked Out.
- At minimum, Release 1 must support Clock In and Clock Out; break events are required if working time “including breaks” is to be accurate.
- Prevent duplicate clock-in, clock-out without clock-in, overlapping open sessions, and cross-organization access.
- Server timestamp is authoritative. Client time is informational only.
- Mutation endpoints accept idempotency keys to prevent double submissions.
- Overnight shifts must be associated with the intended work date.

#### ATT-004 — Derived attendance record

- Work date, first check-in, last check-out, gross elapsed time, paid/unpaid break time, net work time, overtime/extra time, schedule, and status.
- Status values: Present, Absent, Half-day, Leave, Holiday, Week Off, Incomplete, and Pending Correction.
- Recalculation is deterministic from clock events, schedule, holidays, and approved leave.
- Finalized payroll periods lock payroll inputs; later corrections create adjustment records rather than rewriting the finalized snapshot.

#### ATT-005 — Employee attendance view

- Defaults to current month and current employee.
- Month and week navigation.
- Summary counts: present days, leave days, total scheduled working days, net work hours, and overtime.
- Table columns: date, check-in, check-out, work hours, extra hours, and status.
- Show incomplete/missing records and allow a correction request with reason.

#### ATT-006 — Admin/HR attendance view

- Defaults to current local day across all active employees.
- Search employees.
- Previous/next date, direct date picker, Day and Range/Week modes.
- Table columns: employee, check-in, check-out, work hours, extra hours, and status.
- View clock event history and approve/reject corrections with comment.
- CSV export is optional Release 1 scope and must not be assumed.

#### ATT-007 — Attendance approval/correction

- Employee requests correction to check-in, check-out, or reason for missing attendance.
- Admin/HR approves or rejects with comment.
- Approved correction creates an explicit adjustment, recalculates the day, and writes an audit event.
- If payroll is finalized, the correction is queued as a next-period adjustment.

### 5.5 Time off

#### LEAVE-001 — Leave types

- Seed Paid Time Off, Sick Leave, and Unpaid Leave.
- Configurable paid/unpaid, attachment rule, color/icon, half-day support, approval requirement, negative-balance rule, and active status.
- Sick leave can require a medical certificate based on duration/policy, not merely on UI presence.

#### LEAVE-002 — Policies and allocations

- Annual entitlement, carry-forward, carry-forward cap/expiry, accrual frequency, proration for joining/leaving, and negative balance.
- Allocation records can be generated by policy or manually granted by Admin/HR.
- Every balance is reproducible from a ledger: credits, approved debits, reversals, expiry, and adjustments.
- The Allocation tab lists allocations and their source.

#### LEAVE-003 — Leave request

- Employee is auto-filled for self-service; authorized HR can submit on behalf of an employee.
- Capture leave type, start/end dates, optional start/end half-day session, remarks, and attachments.
- Show computed requested units and projected balance before submission.
- Exclude holidays/weekends according to policy.
- Reject invalid range, overlap with another active request, insufficient balance when negative balance is disallowed, or missing required attachment.
- Draft is optional; submitted requests start Pending.

#### LEAVE-004 — Leave decision

- Admin/HR can search/filter and open all requests.
- Approve or reject with comment.
- Decision uses a transaction and locks/rechecks the balance to prevent concurrent over-allocation.
- Statuses: Pending, Approved, Rejected, Cancelled.
- Approval creates leave-ledger debit and updates derived attendance immediately.
- Rejection preserves request and comment but does not debit balance.
- Employee cancellation reverses an approved debit only when policy permits and records audit history.

#### LEAVE-005 — Calendar

- Employee annual calendar shows approved/validated, pending/to approve, rejected/refused, and holidays with a legend.
- Clearly distinguish request range from counted leave units.
- Display Paid and Sick available balances; provide other balances in a detailed panel.
- Admin view shows employee, start date, end date, type, status, and approve/reject actions.

### 5.6 Salary and payroll

#### PAY-001 — Salary assignment

- Fixed wage is the initial wage type.
- Store monthly wage, derived/display yearly wage, working days per week, break time, currency, effective-from/to, and status.
- Salary assignments are versioned; edits create a new effective version.
- Only one active assignment per employee/date.

#### PAY-002 — Salary component definitions

Initial components from the screenshots:

- Basic Salary.
- House Rent Allowance.
- Standard Allowance.
- Performance Bonus.
- Leave Travel Allowance.
- Fixed Allowance.
- Employer PF contribution.
- Employee PF deduction.
- Professional Tax deduction.

Each component contains:

- Stable code and display name.
- Earning, deduction, employer contribution, or balancing component type.
- Fixed amount or percentage calculation mode.
- Percentage basis: wage, basic, or another allowed component.
- Rate/value, rounding rule, display order, taxable flag, and active/effective dates.
- A safe formula representation; never evaluate arbitrary JavaScript or user-provided code.

#### PAY-003 — Calculation rules

- Example: if wage is INR 50,000 and Basic is 50% of wage, Basic is INR 25,000.
- Example: if HRA is 50% of Basic, HRA is INR 12,500.
- PF rates are configurable; screenshot default is 12% of Basic for employer and employee.
- Professional Tax is configurable by organization/jurisdiction; screenshot example is INR 200 per month.
- Fixed Allowance may balance the remaining gross wage after configured earning components.
- Validate that fixed earnings do not create a negative balancing component.
- Prevent circular percentage dependencies.
- Money uses decimal arithmetic and an explicit rounding policy.
- Yearly display is derived from monthly wage unless a signed requirement says otherwise.

#### PAY-004 — Payable-day calculation

- Determine scheduled working days for the payroll period from effective work schedules and applicable holidays.
- Approved paid leave counts according to policy.
- Approved unpaid leave reduces payable units.
- Absent days and unapproved missing attendance reduce payable units after attendance cut-off/approval.
- Half-days reduce units by 0.5 unless policy differs.
- Incomplete attendance is an exception requiring Admin resolution before finalization.
- Record numerator, denominator, and each deduction reason in the payroll calculation snapshot.

#### PAY-005 — Payroll period lifecycle

- Draft → Calculated → Reviewed → Finalized.
- Calculation is repeatable while Draft/Calculated.
- Review shows employee exceptions: missing attendance, overlapping salary versions, negative balances, incomplete bank/statutory data, and calculation validation failures.
- Finalization is Admin-only, requires recent authentication, and writes an immutable snapshot/audit event.
- Reopen requires a privileged, audited correction flow or is disallowed after export.

#### PAY-006 — Visibility

- Admin sees Salary Info configuration and all payroll calculation details.
- HR visibility is an explicit permission.
- Employee sees only own finalized summary if Stage 0 accepts the proposed interpretation.
- All salary list/API responses default to denial and require explicit authorization.
- Downloadable payslip PDF remains deferred.

### 5.7 Audit and operational administration

#### AUD-001 — Audit log

- Actor, organization, action, resource type/ID, timestamp, request/correlation ID, IP, user agent, result, and redacted before/after summary.
- Cover sign-in security events, account/role changes, employee edits, file access, attendance changes, leave decisions, salary edits, payroll calculation/finalization, and configuration changes.
- Audit records are append-only to application users.

#### AUD-002 — Data retention

- Define retention for sessions, activation/reset tokens, audit logs, employee records, attachments, attendance, leave, and payroll before production.
- Deactivation is the normal operation; destructive deletion requires a separate legal/privacy workflow.

---

## 6. UX and route map

### 6.1 Public routes

| Route | Screen |
|---|---|
| /sign-in | Email/Login ID and password |
| /sign-up | Company + first Admin registration |
| /verify-email | Verification result and resend |
| /activate | Invited employee sets password |
| /forgot-password | Reset request |
| /reset-password | Token validation and new password |

### 6.2 Authenticated routes

| Route | Access | Screen/behavior |
|---|---|---|
| /dashboard | Employee | Quick actions, clock status, leave summary |
| /employees | Admin/HR; limited employee directory if enabled | Searchable employee cards and work status |
| /employees/new | Admin/authorized HR | Create employee/invite |
| /employees/[id] | Policy-based | Read-only employee summary |
| /employees/[id]/edit | Admin/authorized HR | Editable employment/profile fields |
| /me | All | Own profile |
| /me/resume | All | About, skills, certifications |
| /me/private | Own; Admin/authorized HR | Private and bank/statutory data |
| /employees/[id]/salary | Admin only by default | Salary structure and component configuration |
| /attendance | Employee | Own month/week view |
| /attendance/team | Admin/HR | Daily/range team attendance |
| /attendance/corrections | Role-based | Submit or decide corrections |
| /time-off | Employee | Balances and annual calendar |
| /time-off/new | Employee/authorized HR | Leave request form/modal |
| /time-off/requests | Admin/HR | Search and approve/reject |
| /time-off/allocations | Admin/HR | Leave allocations and ledger |
| /settings/holidays | Admin/HR | Holiday calendar |
| /settings/schedules | Admin/HR | Work schedules |
| /payroll | Admin | Payroll periods and exceptions |
| /payroll/[period] | Admin | Calculate, review, finalize |
| /me/payroll | Employee if approved | Finalized own summaries |
| /settings/organization | Admin | Company/logo/timezone/currency |
| /settings/security | Admin | Roles, users, sessions |
| /audit | Admin | Audited event search |

### 6.3 Required UI states for every data screen

- Initial loading and background refresh.
- Empty state with a valid next action.
- Validation error with field-level message.
- Authorization denied.
- Not found.
- Network/server failure with safe retry.
- Stale update/conflict.
- Success confirmation.
- Pagination/loading-more state.
- Responsive behavior at phone, tablet, small laptop, and desktop widths.
- Keyboard and screen-reader behavior.

### 6.4 Design system baseline

- Convert the sketches into a deliberate production visual system; do not imitate the hand-drawn Excalidraw style.
- The visual direction is sleek, modern, clean, calm, and professional: crisp typography, neutral surfaces, subtle borders, controlled radius, restrained shadows, generous whitespace, and strong information hierarchy.
- Use shadcn/ui as the component-system foundation. Components are owned as application source and composed into Dayflow-specific patterns rather than replaced by hand-built equivalents.
- Avoid decorative gradients, excessive cards, oversized rounded containers, glass effects, and animation that competes with HR data.
- Define color tokens for neutral, success/present, warning/absent, leave, pending, approved, rejected, focus, and destructive actions.
- Define theme values through semantic CSS variables. Components use semantic tokens such as background, foreground, muted, primary, destructive, border, ring, and dedicated approved/pending/leave status tokens rather than raw Tailwind colors.
- Status must never rely on color alone; use text/icon plus color.
- Use consistent date, time, duration, and INR formatting.
- Tables need sticky headings where useful, keyboard-operable row actions, and mobile alternatives.
- Modals must trap focus, have labelled titles/descriptions, support Escape where safe, and warn before discarding dirty forms.

### 6.5 shadcn component composition map

| Dayflow need | shadcn foundation |
|---|---|
| Main application navigation | Sidebar, NavigationMenu, Breadcrumb, DropdownMenu |
| Employee directory | Card, Avatar with fallback, Badge, InputGroup search, Pagination |
| Profile information | Tabs with TabsList, Card composition, Separator, Avatar |
| Profile and policy forms | FieldGroup, Field, FieldSet, Input, Select, Combobox, Textarea, Switch |
| Attendance day/week/month choice | ToggleGroup rather than manually styled active buttons |
| Attendance and approval records | Table, Badge, DropdownMenu, Sheet for detail/filter views |
| Leave request | Dialog on desktop, Drawer where appropriate on mobile, Calendar, Select, Textarea, file input pattern |
| Approve/reject confirmation | AlertDialog with explicit title, description, safe cancel, and decision comment |
| Salary and payroll screens | Tabs, Table, Card, Field, Alert, Tooltip, Collapsible exception details |
| Loading state | Skeleton and Spinner |
| Empty state | Empty component with one clear primary action |
| Validation or system warning | Field validation and Alert |
| Save/decision feedback | sonner toast plus persistent inline error when action is not recoverable |

### 6.6 shadcn implementation rules

- Check the installed component inventory before adding anything and use the project package runner for shadcn CLI commands.
- Use existing shadcn primitives and built-in variants before writing a new component or visual variant.
- Use class names for layout; theme components through semantic variables and supported variants.
- Use gap-based flex/grid layout rather than space-x or space-y utilities.
- Forms use FieldGroup and Field, with data-invalid and aria-invalid for validation.
- Dialog, Sheet, and Drawer always include accessible titles and descriptions.
- TabsTrigger always lives inside TabsList.
- Avatar always includes AvatarFallback.
- Use Badge for status, Alert for callouts, Empty for empty results, Skeleton for loading, Separator for visual division, and sonner for transient feedback.
- Buttons show pending state by composing Spinner and disabled state.
- Use the icon library configured by the selected shadcn preset; do not hard-code a different icon library.
- Select the exact shadcn base, style preset, icon library, radius, typography, and light/dark palette during Stage 2 and record the choice. Do not switch presets later without a controlled component diff.

---

## 7. Technical architecture

### 7.1 Repository shape

    apps/
      web/              Next.js application
      api/              NestJS API
    packages/
      api-client/       Generated client from OpenAPI
      ui/               Shared design-system components
      config/           Shared TypeScript, lint, and test configuration
      domain-testkit/   Builders/fixtures for domain tests
    prisma/
      schema.prisma
      migrations/
      seed/
    docs/
      IMPLEMENTATION_PLAN.md
      decisions/
      api/
      runbooks/
    resources/
      Dayflow - Human Resource Management System.pdf
      image*.png       Source screenshots retained for traceability

Use pnpm workspaces and a task runner such as Turborepo. Pin exact runtime and dependency versions at Stage 1 after compatibility checks; do not encode “latest” as a reproducibility strategy.

### 7.2 Frontend

- Next.js App Router.
- Server Components for authenticated page composition and low-interactivity reads where practical.
- Client Components only for forms, tables with rich interaction, calendars, check-in/out state, and menus.
- A generated typed API client; the browser must not import backend database types.
- React Hook Form plus a shared validation schema approach for client ergonomics, while the API remains authoritative.
- TanStack Query is optional for live/interactive server state; adopt it only where it reduces complexity.
- Route-level error and loading boundaries.
- No direct Neon connection from the browser.
- Use secure backend-for-frontend cookie forwarding only if needed; avoid duplicating domain logic in Next.js route handlers.

### 7.3 Backend

- NestJS modules: Auth, Organizations, Users, Employees, Files, Schedules, Holidays, Attendance, Leave, Payroll, Audit, Health.
- REST API under /v1.
- OpenAPI document generated in CI.
- Global payload validation with unknown fields rejected.
- Consistent error envelope containing code, safe message, details where valid, and correlation ID.
- Service layer owns transactions and invariants.
- Repository/database access is organization-scoped by construction.
- Background jobs for email delivery, file scanning callbacks, attendance materialization, accrual, and payroll recalculation.
- Use an outbox table so committed domain changes and asynchronous jobs cannot drift.

### 7.4 Database and Neon

- Neon PostgreSQL is appropriate for this relational, transaction-heavy domain.
- Separate production and non-production Neon projects, or rigorously isolated branches with access controls.
- Use a pooled runtime connection and a direct migration connection.
- Run migrations from one controlled deployment job, never concurrently from every API instance.
- Choose the Neon region nearest the API runtime.
- Enable backup/PITR appropriate to the selected Neon plan and test restoration before launch.
- Use preview/database branches for integration or pull-request environments when practical.
- Never copy unmasked production HR/salary data into developer environments.

### 7.5 Object storage

- S3-compatible private buckets separated by environment.
- Object keys include environment and organization ID but never rely on path alone for authorization.
- Presigned upload URL has short expiry, exact content constraints, and expected checksum.
- API completes the upload only after object metadata verification.
- Download requires an authorization check and returns a short-lived signed URL or streamed response.

### 7.6 Email

Release 1 needs transactional identity email even though general HR notifications are deferred:

- Company Admin verification.
- Employee activation.
- Password reset.
- Security-sensitive account change.

Use provider abstraction, templates, delivery event capture, retries, idempotency, and a local development sink.

### 7.7 Deployment topology

    Browser
       |
       v
    Next.js web
       |
       v
    NestJS API  ---> Object storage
       |
       +-------> Email provider
       |
       +-------> Job worker/outbox consumer
       |
       v
    Neon PostgreSQL

The web host, API host, object storage, and email vendor are Stage 1 decisions. The API should run in a standard Node.js container or managed Node runtime close to Neon.

---

## 8. Data model blueprint

Every organization-owned table includes organization_id, created_at, updated_at, and where appropriate created_by, updated_by, version, and archived_at.

### 8.1 Identity and tenancy

| Entity | Important fields and constraints |
|---|---|
| Organization | id, legal_name, display_name, slug, company_prefix, timezone, currency, locale, logo_file_id, status |
| OrganizationSequence | organization_id, sequence_type, year, next_value; unique by organization/type/year |
| User | id, organization_id, email_normalized, password_hash, account_status, email_verified_at, last_login_at |
| UserRole | user_id, role_id; organization-scoped |
| Role | ADMIN, HR_OFFICER, EMPLOYEE plus permission preset |
| Session | user_id, token_hash, family_id, expires_at, revoked_at, device metadata |
| VerificationToken | user_id/email, purpose, token_hash, expires_at, consumed_at |

### 8.2 Employee domain

| Entity | Important fields and constraints |
|---|---|
| Employee | user_id optional until activation, login_id, employee_code, legal/preferred name, dates, status |
| EmploymentAssignment | department, position, manager_employee_id, location_id, schedule_id, effective dates |
| EmployeePrivateProfile | DOB, address, nationality, personal email, gender, marital status |
| EmployeeBankDetail | account holder, encrypted account number, bank, IFSC |
| EmployeeStatutoryDetail | encrypted/masked PAN and UAN |
| EmployeeResume | about, job_love, interests |
| Skill / EmployeeSkill | normalized skill and employee proficiency |
| Certification | employee, issuer, issue/expiry date, credential, file |
| FileObject | owner/resource, bucket/key, MIME, size, checksum, scan status, classification |

### 8.3 Attendance domain

| Entity | Important fields and constraints |
|---|---|
| WorkSchedule | timezone, weekdays, start/end time, break rules, grace and attendance thresholds, effective dates |
| EmployeeScheduleAssignment | employee, schedule, effective range; no overlap |
| HolidayCalendar / Holiday | organization/location calendar, local date, name, optional flag |
| AttendanceEvent | employee, server timestamp, local work date, CLOCK_IN/OUT/BREAK_START/END, source, idempotency key |
| AttendanceRecord | employee + work_date unique, calculated times/durations/status, calculation_version |
| AttendanceCorrection | record, requested changes, reason, status, decision/comment |
| AttendanceAdjustment | approved correction values and audit linkage |

### 8.4 Leave domain

| Entity | Important fields and constraints |
|---|---|
| LeaveType | code, paid flag, attachment/half-day/negative rules, display properties |
| LeavePolicy | leave type, accrual/allocation/carry-forward/proration rules, effective dates |
| EmployeeLeavePolicy | employee, policy, effective dates |
| LeaveLedgerEntry | employee, type, units signed decimal, credit/debit/reversal/expiry/adjustment, source |
| LeaveRequest | employee, type, date/session range, units, remarks, status, submit/decision data |
| LeaveRequestAttachment | request + file |

Balance is SUM of ledger units. A cached balance may exist for reads, but the ledger remains authoritative.

### 8.5 Salary and payroll domain

| Entity | Important fields and constraints |
|---|---|
| SalaryStructure | organization template, name, currency, version, effective dates |
| SalaryComponentDefinition | code, type, calculation mode, basis, rate/amount, order, tax flags |
| EmployeeSalaryAssignment | employee, structure/version, monthly wage, effective range |
| PayrollPeriod | start/end/pay date, lifecycle status, attendance cut-off |
| PayrollRunEmployee | period + employee unique, salary snapshot, attendance units, totals, exception status |
| PayrollLine | component code/type, basis/rate, amount, explanation |
| PayrollAttendanceInput | work date/status/payable fraction/reason snapshot |
| PayrollAdjustment | source period, target period, reason, amount/units |

Use PostgreSQL numeric columns and a decimal library in TypeScript. Never use binary floating point for currency or leave units.

### 8.6 Audit and jobs

| Entity | Important fields and constraints |
|---|---|
| AuditEvent | append-only actor/action/resource/result/context/redacted changes |
| OutboxEvent | aggregate, event type, payload, available/processed time, attempts |
| IdempotencyRecord | organization, actor, endpoint scope, key, request hash, response reference |
| JobRun | job type, schedule, start/end, result, counts, error summary |

### 8.7 Critical database constraints

- All foreign-key relationships that cross business entities must also be validated as same-organization.
- Unique organization + normalized work email where policy requires.
- Unique organization + Login ID.
- Unique organization + employee code.
- Unique employee + work date for materialized attendance.
- No overlapping effective salary assignments.
- No overlapping effective primary schedule assignments.
- Check leave end date is not before start date.
- Check monetary/unit values against defined bounds.
- Payroll run employee unique per period.
- Index all organization_id + common filter/sort columns.

---

## 9. API contract blueprint

### 9.1 Conventions

- Base path /v1.
- JSON uses ISO 8601 timestamps and YYYY-MM-DD local dates.
- Cursor pagination for employee/audit/activity feeds; bounded page pagination is acceptable for calendar-shaped data.
- Filtering and sorting are allow-listed.
- Every response includes or propagates a correlation ID.
- Sensitive mutations support Idempotency-Key.
- Updates include a version/If-Match equivalent for optimistic concurrency.
- Errors use stable machine codes such as AUTH_INVALID_CREDENTIALS, LEAVE_BALANCE_INSUFFICIENT, and ATTENDANCE_ALREADY_CLOCKED_IN.

### 9.2 Endpoint groups

#### Auth and organization

- POST /v1/auth/company-sign-up
- POST /v1/auth/verify-email
- POST /v1/auth/sign-in
- POST /v1/auth/refresh
- POST /v1/auth/sign-out
- POST /v1/auth/sign-out-all
- POST /v1/auth/forgot-password
- POST /v1/auth/reset-password
- POST /v1/auth/change-password
- GET /v1/me
- GET/PATCH /v1/organization

#### Employees

- POST /v1/employees
- GET /v1/employees
- GET/PATCH /v1/employees/:id
- POST /v1/employees/:id/send-activation
- POST /v1/employees/:id/suspend
- POST /v1/employees/:id/deactivate
- GET/PATCH /v1/employees/:id/resume
- GET/PATCH /v1/employees/:id/private-profile
- GET/PATCH /v1/employees/:id/bank-details
- GET/PATCH /v1/employees/:id/statutory-details
- POST/DELETE /v1/employees/:id/skills
- POST/PATCH/DELETE /v1/employees/:id/certifications
- POST /v1/files/upload-intents
- POST /v1/files/:id/complete
- GET /v1/files/:id/download

#### Attendance and calendar

- GET/POST/PATCH /v1/work-schedules
- GET/POST/PATCH /v1/holidays
- POST /v1/attendance/clock-in
- POST /v1/attendance/clock-out
- POST /v1/attendance/break-start
- POST /v1/attendance/break-end
- GET /v1/attendance/state
- GET /v1/attendance/mine
- GET /v1/attendance/team
- POST /v1/attendance/:recordId/corrections
- GET /v1/attendance/corrections
- POST /v1/attendance/corrections/:id/approve
- POST /v1/attendance/corrections/:id/reject

#### Leave

- GET/POST/PATCH /v1/leave-types
- GET/POST/PATCH /v1/leave-policies
- GET /v1/leave-balances
- GET/POST /v1/leave-allocations
- GET/POST /v1/leave-requests
- GET /v1/leave-requests/:id
- POST /v1/leave-requests/:id/submit
- POST /v1/leave-requests/:id/approve
- POST /v1/leave-requests/:id/reject
- POST /v1/leave-requests/:id/cancel
- GET /v1/leave-calendar

#### Salary and payroll

- GET/POST/PATCH /v1/salary-structures
- POST /v1/employees/:id/salary-assignments
- GET /v1/employees/:id/salary-assignments
- GET/POST /v1/payroll-periods
- POST /v1/payroll-periods/:id/calculate
- GET /v1/payroll-periods/:id/employees
- GET /v1/payroll-periods/:id/employees/:employeeId
- POST /v1/payroll-periods/:id/finalize
- GET /v1/me/payroll

#### Operations

- GET /v1/audit-events
- GET /health/live
- GET /health/ready

### 9.3 Transaction boundaries

The following must be atomic:

- Company + first Admin + role + verification token creation.
- Employee + generated Login ID sequence + user/role creation.
- Clock event + current-state update/materialization trigger.
- Leave approval + balance recheck + ledger debit + attendance recalculation request + audit/outbox.
- Leave cancellation + ledger reversal + attendance recalculation request + audit/outbox.
- Salary version creation + old version closure.
- Payroll finalization + immutable employee snapshots + audit/outbox.

---

## 10. Cross-cutting quality requirements

### 10.1 Security

- OWASP ASVS Level 2-inspired release checklist.
- TLS everywhere outside local development.
- CSRF protection for cookie-authenticated unsafe requests.
- Strict CORS allow-list.
- Content Security Policy and security headers.
- Payload size limits and file constraints.
- Rate limits for auth, file intent, check-in/out, and expensive searches.
- No secrets in source control or client bundles.
- Secret rotation runbook.
- Dependency and container scanning in CI.
- Database credentials separated by environment and least privilege.
- Salary/private endpoints denied by default.
- Audit all permission and payroll changes.

### 10.2 Privacy

- Data classification: Public Workplace, Internal, Confidential HR, Restricted Salary/Bank/Identity.
- Response DTOs are purpose-specific; never serialize complete ORM entities.
- Mask bank account, PAN, UAN, tokens, and email where context requires.
- Structured logs use an allow-list and redaction.
- Production support access is audited and time-bound.

### 10.3 Performance targets for Release 1

- p95 read API latency under 500 ms at the agreed normal concurrency, excluding cold-start wake-up.
- p95 standard mutation latency under 800 ms, excluding file upload and email delivery.
- Initial authenticated page usable within 3 seconds on the agreed test device/network.
- Employee directory queries remain bounded and indexed at 10,000 employees per organization.
- Attendance team-day view returns within 1 second for 2,000 employees under the agreed test profile.
- Payroll calculation completes within an agreed batch window and exposes progress rather than holding an HTTP request indefinitely.

Actual load profile and concurrency must be signed off in Stage 0.

### 10.4 Accessibility

- WCAG 2.2 AA target.
- Full keyboard access.
- Visible focus.
- Programmatic labels and error association.
- No color-only status.
- Screen-reader announcement for clock-in/out and approval results.
- Zoom/reflow at 200%.
- Automated axe checks plus manual keyboard/screen-reader smoke tests.

### 10.5 Reliability

- Idempotent sensitive mutations.
- Transactional outbox for asynchronous work.
- Retry with bounded exponential backoff and dead-letter visibility.
- Health/readiness endpoints.
- Graceful shutdown.
- Database restore exercise before launch.
- Clear RPO/RTO based on the selected Neon and storage plans.

### 10.6 Observability

- Structured JSON logs with correlation, organization, actor, route, duration, and result; never sensitive payloads.
- Metrics for request latency/error, auth failures, open attendance sessions, leave job failures, payroll exceptions, queue lag, and email failures.
- Distributed tracing or equivalent request spans across web/API/database/jobs.
- Alert thresholds and runbooks defined before production.

---

## 11. Test strategy

### 11.1 Test layers

| Layer | Purpose |
|---|---|
| Static checks | TypeScript strict mode, lint, formatting, dependency policy, forbidden imports |
| Unit | Salary formulas, leave day counting, status state machines, Login ID generation, authorization decisions |
| Database integration | Constraints, transactions, concurrent approvals, organization isolation, effective-date rules |
| API integration | Validation, auth/session lifecycle, endpoint permissions, error contracts, idempotency |
| Contract | OpenAPI generation and generated frontend client compatibility |
| Component | Forms, tables, calendars, status indicators, modal focus, field redaction |
| End-to-end | Real user journeys using browser + API + PostgreSQL |
| Accessibility | Automated axe plus manual keyboard/screen-reader checklist |
| Security | Dependency scan, SAST, authorization matrix, CSRF/CORS/session/file abuse cases |
| Performance | Directory, attendance day view, check-in/out spikes, leave approval contention, payroll batches |
| Resilience | Email/object-store failures, job retry, database interruption, restore rehearsal |
| UAT | Signed persona-based scripts traced to the PDF/screenshots |

### 11.2 Required test personas

- Company Admin.
- HR Officer with default restricted salary permission.
- Employee A.
- Employee B in same organization.
- Admin and Employee in a second organization.
- Suspended employee.
- Employee without activated account.

Cross-employee and cross-organization denial tests are mandatory, not optional edge cases.

### 11.3 Critical end-to-end journeys

1. Company registers, verifies Admin email, signs in, and sees Employees.
2. Admin creates Employee A; Login ID is generated; employee activates account and changes password.
3. Employee A cannot view Employee B’s private, attendance, leave, or salary data.
4. Employee clocks in once, starts/ends break, clocks out, and sees computed work/overtime values.
5. Duplicate clock-in/out submissions are idempotent and do not create duplicate events.
6. Employee submits Paid Time Off; Admin approves; balance and calendar update; attendance shows Leave.
7. Two Admins attempt to approve leave against the same remaining balance; only a valid transaction succeeds.
8. Sick leave policy requires evidence; invalid/missing file is rejected.
9. Unpaid leave and absence reduce payroll payable units.
10. Salary formula example produces exact decimal results, detects circular formulas, and never exceeds configured wage rules.
11. Payroll with unresolved incomplete attendance cannot finalize.
12. Finalized payroll is immutable and employee sees only own permitted summary.
13. Deactivated user cannot refresh an existing session.
14. File URL from one organization cannot be used by another.
15. Every sensitive action appears in the audit log without secret/private value leakage.

---

## 12. Staged implementation plan and quality gates

No stage is complete because code exists. It is complete only when its tests and exit criteria pass in CI and the required product/technical review is recorded.

### Stage 0 — Requirement baseline and product decisions

#### Work

- Number every accepted requirement using the IDs in this document.
- Conduct a product walkthrough of all source artifacts.
- Resolve the seven conflicts in Section 2.3.
- Decide initial operating model: single-company deployment or multi-tenant SaaS. Keep organization scoping either way.
- Approve roles and HR salary/private-data permissions.
- Approve public company sign-up versus Admin-created tenants.
- Finalize Login ID format, company/name prefix rules, and collision handling.
- Approve employee salary visibility.
- Define work schedule, break, grace, half-day, overtime, overnight-shift, and absence rules.
- Define leave accrual, carry-forward, proration, negative balance, holiday/weekend, attachment, cancellation, and overlapping-request rules.
- Define Indian payroll formulas and whether they are examples or legal rules.
- Define production scale, browser/device support, retention, RPO/RTO, accessibility target, and deployment region.
- Create decision records for every resolved ambiguity.

#### Tests/reviews

- Traceability review: every PDF bullet and visible screenshot annotation maps to a requirement or explicit deferral.
- Persona walkthrough: Admin, HR, and Employee can each complete their intended journeys on paper.
- Calculation examples reviewed by HR/payroll domain owner.
- Security/privacy review of the authorization matrix.

#### Pass gate

- Zero unresolved Priority 0 requirement conflicts.
- 100% of source artifacts represented in the traceability matrix.
- Product owner, HR/payroll owner, and technical owner approve the baseline.

#### Outcome

A signed, versioned product contract that prevents downstream redesign caused by ambiguous onboarding, salary, attendance, or leave rules.

### Stage 1 — Engineering foundation and delivery pipeline

#### Work

- Create pnpm monorepo with apps/web, apps/api, shared packages, Prisma, and docs.
- Prepare the Next.js/shared-UI workspace so shadcn/ui can be initialized after the Stage 2 preset/base decision.
- Pin Node.js, pnpm, Next.js, NestJS, Prisma, PostgreSQL compatibility, and test tooling versions.
- Configure TypeScript strict mode, lint, format, unit test, build, and dependency checks.
- Add environment validation and sample environment documentation.
- Add local PostgreSQL-compatible development setup and controlled Neon environment configuration.
- Establish CI: install, static checks, unit, integration, contract, web build, API build, and migration validation.
- Establish branching/review strategy and conventional migration ownership.
- Add health endpoints, structured logger, correlation IDs, and error envelope.
- Record deployment-host choice and initial cost/region assessment.

#### Tests

- Clean clone installs and builds using documented commands.
- Web and API boot with validated environment.
- CI fails on type error, lint error, failing test, invalid migration, and API contract drift.
- Health readiness fails when database is unavailable.
- No secret is present in repository history/current files.

#### Pass gate

- CI is green from a clean checkout.
- One-command local development path is documented.
- Architecture decision records accepted.

#### Outcome

A reproducible skeleton where every later feature enters through the same quality gates.

### Stage 2 — UX specification and design system

#### Work

- Translate every sketch into high-fidelity desktop and responsive specifications.
- Establish the shadcn preset/base decision, semantic CSS-variable theme, typography, radius, icon library, and component inventory.
- Initialize shadcn/ui with the approved decision and place owned component source in the shared UI package where supported by the chosen monorepo structure.
- Define navigation, role-specific landing, directory cards, profile tabs, attendance tables, leave calendar/modal, approval list, salary editor, and payroll review.
- Define tokens, typography, spacing, components, icons, status semantics, and density.
- Define Dayflow compositions using the component map in Section 6.5 and document any genuinely custom components.
- Define all states listed in Section 6.3.
- Prototype keyboard paths and mobile layouts.
- Create frontend component contracts and accessibility annotations.

#### Tests/reviews

- Screenshot-by-screenshot design review.
- shadcn composition review: semantic tokens, full Card/Tabs/Dialog/Field composition, built-in variants, and accessible status patterns.
- Responsive review at phone, tablet, 1366×768 small laptop, and wide desktop.
- Keyboard-only prototype walkthrough.
- Contrast/status semantics check; no color-only meaning.
- Product owner approves information architecture and role visibility.

#### Pass gate

- Every planned route has a reviewed screen/state specification.
- Zero known critical accessibility blockers in the prototype.
- All screenshot-specific controls are retained or explicitly changed by decision record.
- Every planned UI element maps to an installed shadcn primitive, an approved Dayflow composition, or a documented custom component.

#### Outcome

A build-ready UI specification, eliminating interpretation during feature implementation.

### Stage 3 — Database foundation, tenancy, and audit

#### Work

- Implement Organization, User, Role, UserRole, Employee shell, Session, VerificationToken, AuditEvent, OutboxEvent, IdempotencyRecord, and sequence tables.
- Add organization scoping, indexes, unique/check/foreign-key constraints, timestamps, archive strategy, and optimistic version fields.
- Implement Prisma migration workflow and deterministic seed data.
- Build organization-scoped repository patterns and authorization policy service.
- Build audit writer and transactional outbox foundation.
- Add sensitive logging redaction.

#### Tests

- Migration up from empty database.
- Migration validation against a populated previous schema fixture.
- Cross-organization repository access is denied.
- Database rejects duplicate Login ID and employee code per organization.
- Sequence generation is safe under concurrency.
- Audit and outbox record commit/rollback with the domain transaction.

#### Pass gate

- All schema/integration tests pass on PostgreSQL and a CI Neon branch if adopted.
- Tenant-isolation negative tests cover every initial repository.
- Restoreable seed and migration documentation exists.

#### Outcome

A durable relational and security base before user-facing workflows begin.

### Stage 4 — Authentication, company onboarding, and RBAC

#### Work

- Implement company sign-up and logo upload intent.
- Implement email verification/activation provider abstraction.
- Implement sign-in by email or Login ID, refresh rotation, logout, all-device logout, reset/change password, and account states.
- Implement Admin-created employee/user activation.
- Generate Login ID transactionally.
- Implement authorization guards plus field-level DTO policies.
- Add rate limiting, CSRF/CORS/session cookie controls, and security event audit.

#### Tests

- Unit tests for normalization, Login ID format, password policy, token expiry, and role grant rules.
- Integration tests for concurrent Login ID creation and refresh-token reuse detection.
- API tests for verification, activation, expired/used tokens, suspension, deactivation, reset, and generic credential errors.
- Cross-role/cross-organization authorization matrix tests.
- Browser E2E: company sign-up → verify → sign-in; Admin creates employee → activation → sign-in.
- Security tests for CSRF, cookie flags, CORS, brute-force limits, and session revocation.

#### Pass gate

- All identity journeys pass in two organizations.
- No endpoint trusts a client-supplied organization ID or role grant without policy validation.
- Deactivated/suspended users cannot use old access or refresh sessions.
- Security review has no open Critical/High finding.

#### Outcome

Secure tenant onboarding and account access matching the reconciled sign-up screenshots.

### Stage 5 — Employee directory, profiles, and files

#### Work

- Implement employee card directory, search, pagination, and work/public-field DTO.
- Implement profile summary and Resume, Private Info, and Salary Info route shells.
- Implement workplace identity, manager/department/location, resume text, skills, certifications, private data, bank/statutory data, and allowed self-edit.
- Implement avatar, logo, profile document, certification document, and secure file flow.
- Implement masking, classification, audit, and optimistic concurrency.
- Ensure Salary Info is not included in unauthorized navigation or payloads.

#### Tests

- Component tests for cards, search, profile tabs, masked fields, edit conflicts, and upload states.
- API permission tests for every profile field group.
- Employee A cannot access Employee B private/bank/statutory data.
- HR default cannot access salary configuration.
- Cross-organization file and profile access is denied.
- MIME spoof, oversize file, incomplete upload, expired signed URL, and malware-status tests.
- Browser E2E for Admin create/edit and employee allowed self-edit.

#### Pass gate

- Every field visible in image copy 6.png and image copy 7.png has a stored/displayed/permission decision.
- No restricted value appears in directory/search/API logs.
- File security flow passes in the production-like environment.

#### Outcome

A permission-safe employee system of record and directory.

### Stage 6 — Work schedules, holidays, and policy configuration

#### Work

- Implement work schedules, effective employee assignments, shift/break rules, thresholds, and timezone behavior.
- Implement organization/location holiday calendars.
- Implement LeaveType and LeavePolicy configuration with seeded Paid, Sick, and Unpaid types.
- Implement salary component template schema/editor foundation if needed for later payroll work.
- Add policy versioning/effective dates.

#### Tests

- Unit tests for local dates, DST-capable timezone behavior, overnight shifts, weekends, holidays, and effective-date selection.
- Integration tests reject overlapping primary schedule assignments.
- Holiday applicability tests by location and organization.
- Policy permission/audit tests.
- E2E Admin configures a schedule and holiday visible to the correct employee.

#### Pass gate

- Agreed calendar examples calculate correctly.
- Historical effective-date reads remain stable after policy changes.
- All config changes are audited.

#### Outcome

The calendar and policy inputs required for correct attendance, leave, and payroll.

### Stage 7 — Attendance clock and employee attendance

#### Work

- Implement clock-in/out and break state machine with server timestamps/idempotency.
- Materialize daily attendance records and live header status.
- Implement employee current-state control and “Since” display.
- Implement month/week attendance navigation, counts, table, status, work hours, break hours, and overtime.
- Implement incomplete-session handling and daily recalculation job.

#### Tests

- State-machine unit tests for valid/invalid transitions.
- Duplicate/idempotent request tests.
- Concurrency tests for double clock-in and multi-tab actions.
- Calculation tests for normal, late, half-day, overtime, break, overnight, holiday, leave, and incomplete sessions.
- Timezone boundary tests around midnight.
- E2E clock in → break → resume → clock out → employee view.
- Accessibility tests for live status announcements and control labels.

#### Pass gate

- No invalid sequence can create contradictory open sessions.
- Approved calculation fixtures match HR-signed expected values exactly.
- Employee can only retrieve own attendance.

#### Outcome

Reliable employee attendance capture and the employee view represented by image copy 3.png and image copy 8.png.

### Stage 8 — Admin attendance and corrections

#### Work

- Implement team daily/range query with employee search and date navigation.
- Implement Admin table and status filters.
- Implement correction request, review, approve/reject comment, adjustment, and recalculation.
- Add current-day employee live states.
- Add attendance cut-off/lock behavior needed by payroll.

#### Tests

- Query tests at target organization size.
- Permission tests for Employee, HR, and Admin.
- Correction transaction and audit tests.
- Two reviewers deciding the same correction concurrently results in one valid decision.
- Finalized payroll correction produces a future adjustment rather than mutation.
- E2E employee requests correction → HR approves → attendance updates.

#### Pass gate

- Admin view meets the image copy 4.png fields/navigation.
- PDF attendance approval responsibility is demonstrably covered.
- Target attendance query performance passes.

#### Outcome

An auditable Admin/HR attendance workflow ready to feed payroll.

### Stage 9 — Leave balances, allocations, and employee requests

#### Work

- Implement leave ledger, policy assignment, initial/manual allocations, accrual/proration job, carry-forward/expiry mechanics.
- Implement balance summary and allocation administration.
- Implement employee request form with date/session range, remarks, computed units, projected balance, and attachment.
- Implement overlap, holiday/weekend, negative balance, and evidence rules.
- Implement annual employee calendar and status legend.

#### Tests

- Property/unit tests for working-day counting, half-days, holidays, weekends, accrual, carry-forward, expiry, proration, and reversals.
- Ledger invariant tests: balance always reproduces from entries.
- Concurrent allocation/request tests.
- Attachment-required policy tests.
- E2E employee sees 24/7-style seeded balances, submits request, and sees Pending calendar state.
- Calendar accessibility and responsive tests.

#### Pass gate

- HR-approved leave fixtures match balances and requested units.
- Balance cannot be corrupted by retry or concurrency.
- All controls shown in image copy 2.png and image copy.png are implemented or covered by signed deviation.

#### Outcome

Correct self-service time-off requests backed by an explainable ledger.

### Stage 10 — Leave approval and attendance integration

#### Work

- Implement Admin request list, search/filter, approve/reject buttons, details, comments, and Allocation tab.
- Transactionally recheck balance and decide request.
- Update ledger and enqueue immediate attendance recalculation.
- Implement cancellation/reversal policy.
- Add approved leave status to employee cards and calendar.

#### Tests

- Concurrent approval with insufficient remaining balance.
- Approval/rejection idempotency and stale-version conflict.
- Approved request updates ledger, calendar, attendance, and live work status.
- Rejected request leaves balance unchanged.
- Cancellation reverses exactly once.
- E2E full leave request/decision lifecycle.
- Audit contains decision/comment metadata without exposing file contents.

#### Pass gate

- Cross-module updates are consistent after transaction/job completion.
- Admin UI covers image.png table, search, status, approval/rejection, and allocation navigation.
- No known balance or duplicate-decision defect.

#### Outcome

Complete employee-to-HR time-off workflow with immediate attendance impact.

### Stage 11 — Salary structures and calculation engine

#### Work

- Implement salary structure/version editor and employee assignment.
- Implement fixed/percentage component dependency graph.
- Implement Basic, HRA, Standard Allowance, Performance Bonus, LTA, Fixed Allowance, PF, and Professional Tax examples.
- Implement decimal/rounding rules, validation, explanations, and effective dates.
- Restrict salary endpoints/UI and audit all access/changes.

#### Tests

- Golden calculation fixtures including INR 50,000 example.
- Fixed amount, percentage of wage, percentage of Basic, balancing component, deductions, and employer contribution.
- Circular dependency, missing basis, negative balance, excessive components, invalid rate, and rounding boundary tests.
- Version/effective-date tests.
- Permission and data-leak tests across API, UI, logs, audit, and generated client.
- E2E Admin creates salary assignment and unauthorized HR/Employee cannot open configuration.

#### Pass gate

- Payroll/HR owner signs off exact formulas and rounding.
- Golden fixtures are immutable regression tests.
- Zero unauthorized salary disclosure.

#### Outcome

A deterministic, versioned salary engine matching image copy 6.png and image copy 7.png.

### Stage 12 — Payroll calculation, review, and employee visibility

#### Work

- Implement payroll periods and attendance cut-off.
- Snapshot salary version, schedule, holidays, attendance, paid/unpaid leave, absence, and half-day inputs.
- Calculate payable days, prorated earnings/deductions/contributions, gross, deductions, employer cost, and net.
- Build exception review and prevent finalization with blocking exceptions.
- Implement Admin-only finalize with recent authentication and immutable snapshots.
- Implement employee own finalized summary if approved in Stage 0.

#### Tests

- Golden payable-day fixtures: full attendance, paid leave, unpaid leave, absence, half-day, holiday, missing/incomplete attendance, join/exit mid-period.
- Replay produces identical results from identical snapshot inputs.
- Finalization concurrency and idempotency.
- Finalized snapshot remains unchanged after later salary/policy/profile edits.
- Post-finalization correction creates adjustment.
- Employee can see only own finalized allowed fields.
- Batch performance test at target employee count.
- E2E attendance + leave → payroll calculation → exception resolution → finalize → employee summary.

#### Pass gate

- Payroll owner reconciles golden fixtures manually to exact expected totals.
- No unresolved blocking exception can be finalized.
- Finalized records are immutable and fully auditable.
- Target batch window passes.

#### Outcome

Attendance-driven payroll accuracy without prematurely building downloadable payslips.

### Stage 13 — Dashboards and cross-module product polish

#### Work

- Complete role-specific landing dashboards and quick-access cards.
- Complete employee live status indicators with correct precedence.
- Add recent activity/security alerts where source data exists.
- Add skeleton/empty/error/conflict/success states throughout.
- Implement responsive tables/calendars and final navigation/profile menu.
- Remove accidental dead ends and ensure deep links preserve authorization.

#### Tests

- Persona-based navigation E2E at all target viewport sizes.
- Work-status fixtures for present, leave, absent, holiday/week off, and unknown.
- Visual regression for all source-derived screens.
- Keyboard, focus, screen-reader, contrast, and 200% zoom checks.
- No unauthorized data flashes during loading/hydration.

#### Pass gate

- Product/design accepts screenshot traceability.
- WCAG target has no known Critical/Serious automated issue and manual checklist passes.
- All primary journeys can be completed without direct URL knowledge.

#### Outcome

A coherent production product rather than isolated backend-complete modules.

### Stage 14 — Security, performance, resilience, and UAT

#### Work

- Complete threat model and abuse cases.
- Run dependency, SAST, secret, container, API, authorization, and file security assessments.
- Tune indexes/queries and eliminate N+1 queries.
- Run load tests against agreed profiles.
- Exercise email/object-storage failure and job retry/dead-letter paths.
- Run database and file restore rehearsal.
- Execute full UAT scripts with anonymized realistic data.
- Produce privacy, retention, support, incident, and payroll correction runbooks.

#### Tests

- Full CI/regression suite.
- Authorization matrix automation across all endpoints.
- OWASP-focused dynamic/API checks.
- Performance test with p95/error thresholds.
- Backup restore and recovery timing.
- UAT traceability: each accepted requirement has pass evidence.
- Browser compatibility and production-like smoke.

#### Pass gate

- Zero open Critical/High security findings.
- No unresolved Priority 0/1 functional defect.
- Performance, accessibility, restore, and UAT thresholds pass.
- Product, HR/payroll, security, and engineering sign release candidate.

#### Outcome

A release candidate supported by evidence, not optimism.

### Stage 15 — Production readiness and controlled launch

#### Work

- Provision production web/API/jobs, Neon, object storage, email, DNS/TLS, monitoring, and secret management.
- Run controlled migrations and seed only required reference data.
- Configure alerts, dashboards, on-call ownership, and support escalation.
- Create first production organization/Admin through approved secure process.
- Run smoke tests and a pilot with a small employee group.
- Define rollback/roll-forward decision criteria.
- Monitor clock events, leave decisions, payroll exceptions, latency, errors, email, and queue lag.
- Expand rollout only after pilot exit review.

#### Tests

- Production readiness checklist.
- Migration dry run using production-like snapshot.
- Post-deploy auth, employee, attendance, leave, salary permission, and health smoke.
- Alert test and on-call acknowledgement.
- Pilot payroll parallel run against a trusted manual calculation before relying on system output.

#### Pass gate

- Smoke, observability, backup, and rollback checks pass.
- Pilot has no unresolved payroll/security/data-integrity issue.
- Product/HR/engineering approve wider rollout.

#### Outcome

A monitored, reversible launch with validated HR and payroll data.

### Stage 16 — Post-launch stabilization and future enhancements

#### Work

- Two-release stabilization window focused on correctness and support feedback.
- Compare calculated attendance/payroll to approved source records.
- Prioritize future notifications, analytics, attendance reports, and salary-slip PDFs.
- Revisit Time-Off Officer custom role, bulk import/export, mobile/PWA, biometric integrations, and statutory automation based on evidence.

#### Tests/gates

- Production error/latency/SLA review.
- Payroll variance report.
- Support ticket root-cause analysis.
- Future enhancement acceptance criteria written before implementation.

#### Pass gate

- No recurring high-severity correctness issue.
- Product metrics and support evidence justify the next scope.

#### Outcome

A stable core and an evidence-based roadmap rather than uncontrolled scope growth.

---

## 13. Requirement-to-stage traceability

| Requirement/source | Primary stage(s) | Mandatory evidence |
|---|---|---|
| PDF 3.1 + image copy 9: auth/onboarding | 4 | Company and employee activation E2E, role/auth security tests |
| PDF 3.2 + image copy 8: dashboards/directory | 5, 13 | Persona navigation and visual regression |
| PDF 3.3 + images copy 6/7: profiles | 5, 11 | Field inventory, permission tests, profile E2E |
| PDF 3.4 + images copy 3/4/5/8: attendance | 6–8 | State machine, calculation goldens, employee/Admin E2E |
| PDF 3.5 + image.png + images copy/copy 2: leave | 6, 9, 10 | Ledger invariants, approval concurrency, calendar E2E |
| PDF 3.6 + images copy 5/6/7: payroll | 11, 12 | Formula/payable-day goldens, immutable finalization |
| PDF future enhancements | 16/backlog | Explicit deferral and later acceptance criteria |
| Role-based access and privacy | 3–15 | Automated authorization matrix and data-leak tests |
| Annual holidays/legend | 6, 9, 10 | Calendar and holiday applicability tests |
| Attendance status dots | 7, 10, 13 | Status precedence fixtures |
| Allocation tab | 9, 10 | Ledger/allocation UI and API tests |
| Attachment/certificate | 5, 9 | Secure upload and policy validation tests |
| Salary tab admin-only annotation | 5, 11, 12 | Denial and payload redaction tests |
| Attendance drives payable days | 8, 12 | End-to-end payroll reconciliation |

---

## 14. Definition of done for every feature

A feature is done only when:

- Accepted requirement ID and decision record are linked.
- UX includes loading, empty, error, conflict, unauthorized, responsive, and accessible behavior.
- API contract and generated client are updated.
- Database migration is backward-safe or has a reviewed deployment sequence.
- Authorization is tested for Admin, HR, self Employee, other Employee, and other organization.
- Unit/integration/E2E coverage is proportional to risk.
- Audit and logging behavior is verified.
- Sensitive data is classified/redacted.
- Observability and support behavior exist.
- Documentation and runbook are updated.
- CI and relevant stage gate pass.
- Product acceptance evidence is recorded.

---

## 15. Decisions still needed before implementation

These are not reasons to stop planning, but Stage 0 cannot pass without answers:

1. Is Dayflow a multi-company SaaS or a dedicated deployment for one company?
2. Can anyone create a company, or is company creation controlled internally?
3. Are Admin and HR separate roles, and exactly who can see salary, bank, PAN, and UAN data?
4. Can employees browse a company directory? Which fields are public internally?
5. Should employees see finalized payroll summaries in Release 1?
6. Is a temporary password mandatory, or may we use the safer activation-link set-password flow?
7. Exact Login ID prefix and name-abbreviation algorithm.
8. Attendance grace, half-day/full-day, break, overtime, overnight, missing-record, and correction rules.
9. Whether attendance approval applies to every day or only corrections/exceptions.
10. Leave accrual/carry-forward/proration/negative balance/cancellation rules and sick-certificate threshold.
11. Applicable holiday calendars by company/location.
12. Salary formulas, percentage bases, rounding, PF applicability/caps, Professional Tax jurisdiction, and other statutory deductions.
13. Payroll frequency, cut-off, pay date, joiner/leaver proration, and finalization/reopen policy.
14. Expected employee count/concurrency and deployment geography.
15. Required data retention, backup RPO/RTO, and compliance obligations.
16. Hosting, object storage, and transactional email vendor.
17. Whether any actual Odoo API/data synchronization is required, or “Odoo India” is only example company data.

---

## 16. Recommended implementation order

The stage order is intentional:

1. Freeze requirements and permissions.
2. Build reproducible engineering and UX foundations.
3. Establish tenancy/audit before business data exists.
4. Secure identities.
5. Establish employee records.
6. Establish calendars and policies.
7. Capture attendance.
8. Correct/approve attendance.
9. Calculate leave balances and requests.
10. Integrate leave decisions with attendance.
11. Calculate salary structures.
12. Snapshot payroll from attendance/leave/salary.
13. Polish dashboards and end-to-end UX.
14. Prove security, performance, resilience, and acceptance.
15. Launch through a pilot and parallel payroll run.

Building payroll before schedules, attendance, leave, and their approval semantics are stable would create false confidence and expensive rewrites.

---

## 17. Technology validation notes

- Next.js App Router is the selected frontend routing/rendering model.
- NestJS provides global validation and OpenAPI tooling suitable for a separate typed REST API.
- Prisma supports Neon PostgreSQL and documents pooled runtime connections plus direct migration connections.
- Neon database branching is useful for isolated preview/integration environments, but production HR data must never be exposed unmasked.
- Exact versions and runtime adapters must be pinned and verified in Stage 1 rather than assumed from a planning document.

Official references:

- Next.js documentation: https://nextjs.org/docs
- NestJS validation: https://docs.nestjs.com/techniques/validation
- NestJS OpenAPI: https://docs.nestjs.com/openapi/introduction
- Prisma with Neon: https://docs.prisma.io/docs/orm/overview/databases/neon
- Prisma PostgreSQL connections: https://www.prisma.io/docs/orm/core-concepts/supported-databases/postgresql

---

## 18. Final planning acceptance checklist

- [ ] All ten screenshots reviewed and mapped.
- [ ] All five PDF pages reviewed and mapped.
- [ ] Linked Excalidraw preview checked for board completeness.
- [ ] Requirement conflicts signed off.
- [ ] Role/field permission matrix signed off.
- [ ] Attendance rules signed off.
- [ ] Leave policy rules signed off.
- [ ] Salary/payroll formulas signed off by a domain owner.
- [ ] Release 1 and future scope signed off.
- [ ] Architecture and data model reviewed.
- [ ] API boundaries reviewed.
- [ ] Every stage has tests, a pass gate, and a defined outcome.
- [ ] UAT scripts trace to every accepted requirement.
- [ ] Pilot and parallel payroll validation accepted before full launch.

Implementation should begin only after the Stage 0 gate passes.
