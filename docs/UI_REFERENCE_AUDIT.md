# Dayflow UI reference audit

Last audited: 2026-08-22

This document treats the supplied wireframes as the functional layout contract and
the PDF as the role/permission contract. The shipped UI may modernize typography,
spacing, navigation, responsiveness, and component styling, but it must preserve the
information architecture and workflows below.

## Role surfaces

| Surface | Employee | HR Officer | Admin |
|---|---|---|---|
| Post-login landing | Employee directory with work-status indicators | Same directory plus operational access | Same directory plus operational and payroll access |
| Employee directory/profile | Public work profiles; own editable profile | Public profiles; permitted employee data | Full employee administration and salary assignment |
| Attendance | Own month/day records, counters, clock controls, correction request | Current-day organization register and correction review | Same as HR |
| Time Off | Own balances, full-year calendar, holidays, request dialog and statuses | Search all requests, comment, approve/reject, view allocations | Same as HR plus policy configuration |
| Payroll | Own finalized read-only summaries | No salary configuration by default | Salary structures, assignments, payroll calculate/review/finalize |

## Screenshot traceability

| Artifact | Required UI behavior | Current gap/action |
|---|---|---|
| `image copy 9.png` | Sign-in/company setup; generated Login ID; employees cannot self-register | Authentication exists. Invitation link recovery was added; production email delivery remains an external gate. |
| `image copy 8.png` | Employee directory is the post-login landing page; searchable employee cards; avatar menu; presence/leave/absence indicator; clock access | Implemented: sign-in lands on the directory, searchable view-only cards show today’s attendance indicator, the directory exposes compact check-in/out, and the top-bar avatar menu provides My Profile and Log out. |
| `image copy 3.png` | Employee attendance month navigation; present, leave and working-day counts; date/check-in/check-out/work/extra-hours table | Implemented: previous/next month navigation, period picker, counters, clock state and the own-record table are present. |
| `image copy 4.png` | Admin/HR daily attendance list; employee search; previous/next date and day view | Implemented: Admin/HR daily register has search, previous/next day navigation, date picker, metrics and organization-scoped rows. |
| `image copy 5.png` | Attendance includes breaks; attendance drives payable days; unpaid leave and missing attendance reduce payroll | Calculation is implemented. UI must make the monthly/day relationship and payroll evidence clearer. |
| `image copy.png` | Employee Time Off balances plus a twelve-month calendar and holiday/status legend | Implemented: balances, full twelve-month calendar, request states, applicable holidays, year navigation and request history are shown together. |
| `image copy 2.png` | Time-off request dialog: employee, type, date range, units, conditional attachment | Implemented except external gate: employee identity is derived from the session, units are calculated server-side from policy, and secure attachment remains disabled until file storage/scanning is configured. |
| `image.png` | Admin/HR searchable request table with approve/reject controls | Implemented: status filtering, search, remarks, mandatory reviewer comments and version-safe approve/reject dialogs. |
| `image copy 6.png` | Profile opens from My Profile; Resume, Private Info, Salary Info, Security; salary formula specification | Implemented: employment context remains in the profile header; Resume, Private Info, Admin-only Salary Info and Security tabs follow the reference. Session-device management remains a later security enhancement. |
| `image copy 7.png` | Admin can view/edit salary details; Salary Info is hidden from ordinary employees; resume/skills/certifications | Implemented: Admin-only salary assignment/component context links to structure management; the API continues to deny salary-assignment access to Employee and HR roles. |

## PDF requirements not optional in the visual pass

- Employee dashboard: quick access to profile, attendance, leave and logout plus
  recent activity or alerts.
- Admin/HR dashboard: employee list, attendance records, leave approvals and ability
  to switch between employees.
- Employee profile: personal/job details, salary visibility per resolved permission,
  documents and profile picture; employees edit only permitted fields.
- Attendance: own daily/monthly view for employees and organization view for HR/Admin.
- Time Off: Paid, Sick and Unpaid selection, date range, remarks, Pending/Approved/
  Rejected states, reviewer comments and immediate record updates.
- Payroll: employee view is read-only; Admin owns structure changes and payroll accuracy.

## Implementation order

1. Completed — Employee annual Time Off calendar and request context.
2. Completed — Admin/HR Time Off search, reviewer comments and manual allocations.
3. Completed — Attendance month/day navigation and reference counters.
4. Completed — Directory landing and today-status alignment.
5. Completed — Admin-only salary context and role-aware profile/security states.
6. Open acceptance gate — authenticated responsive visual, keyboard and accessibility review for Employee, HR and Admin accounts.

## Navigation decision

The authenticated shell exposes only the three screenshot-defined primary modules:
Employees, Attendance and Time Off. My Profile and Log out live in the avatar menu.
Role-specific routes resolve behind those modules: Employee receives own attendance and
calendar views, while Admin/HR receives team attendance and request approval views.
Configuration, payroll and support routes remain implemented but are intentionally
hidden from primary navigation; Admin reaches salary configuration contextually from
an employee's Salary Info tab.
