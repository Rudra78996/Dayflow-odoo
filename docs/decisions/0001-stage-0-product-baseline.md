# Decision 0001 — Stage 0 Product Baseline

Status: Accepted for implementation  
Date: 2026-08-22  
Scope: Release 1 baseline for Dayflow HRMS

Accepted by the product owner's 2026-08-22 direction to proceed through Stage 5. The
payroll, statutory-retention, recovery, and production-hosting assumptions remain
subject to the specialist reviews explicitly called out below before the affected
production gates can pass.

## Context

The supplied PDF and screenshots define the product direction but contain several conflicts or undefined business rules. This decision selects safe, implementable defaults. Approval freezes these defaults for Release 1; later changes require a new decision record and impact review.

## Proposed decisions

### D01 — Product tenancy

Decision: Dayflow is designed as a multi-company SaaS even if the first deployment has one company.

- Every business record is organization-scoped.
- One user belongs to one organization in Release 1.
- Cross-organization data access is always denied.
- Consolidated cross-company administration is deferred.

Reason: Retroactively adding tenant isolation to HR, bank, and salary data would be high risk.

### D02 — Company onboarding

Decision: Public sign-up creates a company and its first Admin only.

- Company sign-up requires company name, Admin name, work email, phone, password, and email verification.
- No public role selector is shown.
- Anti-abuse controls and rate limits apply.
- Employees and additional HR/Admin users are provisioned inside the company by an Admin.

### D03 — Roles and sensitive-data access

Decision: Release 1 has Admin, HR Officer, and Employee roles with permission checks underneath.

- Admin can manage accounts, roles, employee data, salary structures, payroll, leave, attendance, and audit logs.
- HR Officer can manage workplace profiles, private HR information, attendance, and leave.
- HR Officer cannot view or edit salary structures or finalize payroll by default.
- HR Officer can view bank, PAN, and UAN only when an Admin grants the Restricted Employee Data permission.
- Employee can view and edit only permitted fields on their own profile.
- Employee can never view another employee’s private, bank, statutory, attendance, leave, or payroll data.

### D04 — Employee directory

Decision: Authenticated employees may browse a limited internal directory.

Visible directory fields:

- Avatar.
- Preferred/full display name.
- Job title.
- Department.
- Work location.
- Manager name.
- Current workplace status: Present, On Leave, Not Working Today, or Unavailable.

Hidden fields include personal contact details, residential address, bank/statutory data, compensation, attendance history, and leave details.

An organization Admin can disable employee directory access later without redesign.

### D05 — Employee payroll visibility

Decision: Employees see only their own finalized payroll summary.

- Employees do not see the editable Salary Info tab, formulas, employer configuration, or other employees’ data.
- The summary may show pay period, payable days, gross earnings, itemized employee deductions, and net amount.
- Downloadable PDF salary slips are deferred.

### D06 — Account activation

Decision: Use a single-use activation link instead of emailing a generated temporary password.

- Admin creates the employee.
- The system generates Login ID.
- Employee receives an expiring activation link, verifies ownership, and sets the first password.
- Resending activation invalidates the previous link.
- Temporary passwords are not stored or emailed.

### D07 — Login ID

Decision: Login ID is generated server-side using:

    COMPANY_PREFIX + FIRST_NAME_PREFIX + LAST_NAME_PREFIX + JOIN_YEAR + SEQUENCE

Rules:

- Company prefix: 2–4 uppercase ASCII letters/numbers, selected during onboarding.
- Name prefixes: first two normalized letters of first and last names.
- Joining year: four digits.
- Sequence: four digits, unique per organization and joining year.
- Example: OI + JO + DO + 2022 + 0001 = OIJODO20220001.
- Missing/short names use available normalized characters and a deterministic X pad.
- Sequence makes the identifier unique; the internal employee UUID remains the true immutable key.
- Login ID is immutable after activation unless an audited Admin correction is required.

### D08 — Attendance defaults

Decision: Attendance rules are organization-configurable with these Release 1 defaults:

- Work week: Monday–Friday.
- Default schedule: 8 net working hours per day.
- Grace period: 10 minutes.
- Full day: at least 8 net hours.
- Half-day: at least 4 but less than 8 net hours.
- Below 4 net hours: Absent unless approved leave/correction applies.
- Breaks are excluded from net work time when break events are recorded.
- Overtime begins after 8 net hours and is calculated to the minute.
- Overnight shifts are supported and assigned to the scheduled starting work date.
- Open/missing check-out produces Incomplete, not automatic Absent.
- Holiday and Week Off are neutral non-absence statuses.
- Approved leave takes precedence over absence.
- Admin/HR can approve corrections with a mandatory reason/comment.

These are product defaults, not statutory/legal claims.

### D09 — Attendance approvals

Decision: Normal completed attendance does not require daily approval.

Approval is required only for:

- Employee correction requests.
- Missing or incomplete attendance exceptions.
- Manual Admin/HR adjustments.
- Records explicitly flagged by payroll validation.

This keeps routine attendance usable while satisfying the PDF’s attendance approval responsibility.

### D10 — Leave defaults

Decision: Seed three configurable leave types.

Paid Time Off:

- 24 days per calendar year.
- Front-loaded and prorated by remaining complete months for joiners.
- No negative balance.
- No carry-forward in the initial default policy.

Sick Leave:

- 7 days per calendar year.
- Front-loaded and prorated for joiners.
- No negative balance or carry-forward.
- Medical certificate required for more than two consecutive counted sick days.

Unpaid Leave:

- No paid balance required.
- Always requires approval.
- Reduces payroll payable units.

Shared rules:

- Weekends and applicable holidays are excluded from counted units.
- Half-day requests are supported in 0.5-day units.
- Overlapping active requests are rejected.
- Employee may cancel a Pending request.
- Employee may cancel an Approved request before it begins; after start, HR/Admin approval is required.
- Approved cancellation creates a ledger reversal.
- Leave policies are effective-dated and configurable by organization.

### D11 — Holidays

Decision: Holidays are organization/location-managed data.

- Production does not automatically seed the example holidays from the screenshot.
- Admin/HR enters or imports the authoritative company holiday list.
- An employee receives the calendar assigned to their work location.
- Holiday changes are audited and effective by local calendar date.

### D12 — Salary calculation baseline

Decision: Implement a configurable salary engine and use the following formula set as the Release 1 golden development fixture:

- Monthly Wage: INR 50,000.00.
- Basic: 50% of Monthly Wage = INR 25,000.00.
- HRA: 50% of Basic = INR 12,500.00.
- Standard Allowance: 16.67% of Basic = INR 4,167.50.
- Performance Bonus: 8.33% of Basic = INR 2,082.50.
- Leave Travel Allowance: 8.33% of Basic = INR 2,082.50.
- Fixed Allowance: Monthly Wage minus all other earning components = INR 4,167.50.
- Employer PF: configurable percentage of Basic; 12% development default.
- Employee PF: configurable percentage of Basic; 12% development default.
- Professional Tax: configurable fixed deduction; INR 200 development default.

Calculation behavior:

- Decimal arithmetic only; no binary floating-point money.
- Calculate component bases at full precision.
- Round displayed and posted component amounts to two decimals using half-up rounding.
- Fixed Allowance absorbs the earning-side reconciliation difference.
- Circular component dependencies are invalid.
- Final earning components must reconcile exactly to Monthly Wage before attendance proration.
- Statutory caps/applicability are configurable and require payroll-domain validation before production.

The screenshot’s displayed component figures do not fully reconcile to INR 50,000, so they are not treated as accounting truth.

### D13 — Payroll lifecycle

Decision:

- Frequency: monthly calendar period.
- Attendance cut-off: configurable; development default is the final calendar day.
- Pay date: configurable; development default is the final working day.
- Joiner/leaver and absence proration uses scheduled payable working units, not an assumed 30-day divisor.
- Lifecycle: Draft → Calculated → Reviewed → Finalized.
- Blocking attendance/salary exceptions prevent finalization.
- Finalized payroll is immutable.
- Later approved corrections create a next-period adjustment.
- Reopening finalized payroll is not allowed in Release 1.

### D14 — Initial scale and geography

Decision: Engineer and test Release 1 for:

- Up to 2,000 employees in one organization.
- Up to 50 concurrently active users in the initial production profile.
- Asia/Kolkata organization timezone default.
- INR currency default.
- API and Neon region selected as close together and as close to the primary India user base as the chosen providers support.
- Organization timezone/currency remain configuration rather than global hard-coding.

### D15 — Retention and recovery baseline

Decision:

- Free Neon is approved for development, automated testing, demos, and a non-critical pilot.
- Real production attendance/payroll requires a paid database plan or explicit written acceptance of Free-plan recovery/SLA limitations.
- Production target RPO: one hour.
- Production target RTO: four hours.
- Daily encrypted logical exports supplement provider point-in-time recovery.
- Session records: active lifetime plus 30 days after expiry/revocation.
- Activation/reset tokens: delete or irreversibly redact 30 days after expiry/consumption.
- Attendance, leave, payroll, and payroll-related audit records: provisional eight-year retention.
- Employee files and records: employment duration plus provisional eight years, subject to legal/privacy review.
- Data deletion is a separate authorized privacy/legal workflow; normal employee departure uses deactivation.

The eight-year values are provisional product policy, not legal advice, and must be checked for the operating jurisdiction before production.

### D16 — Infrastructure boundaries

Decision:

- Next.js web hosting, Node.js API/worker hosting, S3-compatible private object storage, and transactional email remain provider-portable.
- Neon PostgreSQL is the database provider.
- Free Neon is used initially.
- Exact web/API/object/email vendors are selected during Stage 1 using region, cost, operational, and security criteria.
- Application code must not depend on vendor-specific business logic.
- Attachments are never stored as database binary columns.

### D17 — Odoo integration

Decision: There is no Odoo integration in Release 1.

- “Odoo India” is treated as example company data.
- Dayflow is a standalone Next.js/Node.js application.
- Importing or synchronizing Odoo users, attendance, leave, or payroll requires a separate future integration specification.

### D18 — Frontend direction

Decision: Dayflow uses a sleek, modern, clean shadcn/ui-based design system.

- Neutral, professional surfaces with restrained borders/shadows and strong typography.
- Semantic status colors plus icons/text.
- shadcn primitives are composed into Dayflow patterns.
- Responsive small-laptop, tablet, and phone behavior.
- WCAG 2.2 AA target.
- No hand-drawn Excalidraw styling, decorative gradients, excessive cards, or glass effects.

This decision was explicitly requested by the product owner.

## Stage 0 acceptance scenarios

Stage 0 is ready to pass when the product owner confirms the proposed decisions and the following scenarios are accepted:

1. A visitor creates a company and first Admin, verifies email, and signs in.
2. Admin creates an employee; the employee activates through a link using generated Login ID.
3. Employee can browse only limited workplace directory information.
4. Employee A cannot access Employee B’s private, attendance, leave, bank, statutory, or payroll information.
5. Employee clocks in/out; the system deterministically calculates net work and overtime.
6. An incomplete record requires correction rather than silently becoming payroll truth.
7. Paid/Sick/Unpaid leave uses a reproducible ledger and approved leave updates attendance.
8. Salary components reconcile exactly to monthly wage.
9. Unpaid leave and absence reduce payroll payable units.
10. Finalized payroll cannot be rewritten by later configuration changes.
11. All sensitive changes are audited.
12. No production behavior assumes Odoo connectivity.

## Approval

Product owner:

Decision:

- [ ] Accept Decision 0001 as written.
- [ ] Accept with amendments listed below.
- [ ] Reject and replace.

Amendments:

Approval date:
