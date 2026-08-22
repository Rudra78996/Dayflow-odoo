# Release 1 UAT and evidence worksheet

Use anonymized realistic data. Record build/image digest, environment, tester,
timestamp, test-data seed and linked evidence. “Pass” requires expected data,
authorization, audit and responsive/accessibility behavior—not only a 2xx response.

| Journey                                           | Personas/negative cases                                                     | Evidence                                   | Result/sign-off |
| ------------------------------------------------- | --------------------------------------------------------------------------- | ------------------------------------------ | --------------- |
| Company registration, verification, sign-in/reset | Initial Admin; duplicate/generic errors; expired/replayed tokens            | Browser capture + audit IDs                | Pending         |
| Employee invite/activation/deactivation           | Admin, forbidden HR/Employee, deactivated refresh                           | Browser/API + audit IDs                    | Pending         |
| Directory/profile/private/bank/files              | Admin, HR policy, self, other, other tenant; masked fields                  | Browser/API + storage scan evidence        | Pending         |
| Schedule/holiday/policy configuration             | Admin/HR/Employee; timezone/effective-date boundaries                       | Browser + calculation fixture              | Pending         |
| Clock/break/overnight/correction                  | Self, approver, duplicate idempotency, finalized period                     | Event history + audit                      | Pending         |
| Employee/Admin attendance views                   | Month/week/day/range; missing/holiday/leave states                          | Browser + fixture reconciliation           | Pending         |
| Leave request/allocation/decision/cancel          | Self/HR/Admin; overlap, attachment, concurrent balance                      | Ledger + attendance + audit                | Pending         |
| Salary structure/version                          | Admin and denied HR/Employee; dependency/rounding edge cases                | Golden fixture + leak check                | Pending         |
| Payroll calculate/review/finalize                 | Admin; unresolved exception; concurrent finalize                            | Manual reconciliation + immutable snapshot | Pending         |
| Employee payroll visibility                       | Own finalized only; other employee/tenant denial                            | Browser/API redaction evidence             | Pending         |
| Responsive/accessibility                          | Chromium, Firefox, WebKit; desktop/mobile; keyboard/screen reader/200% zoom | Report and issue links                     | Pending         |
| Recovery/incident/support                         | Operator restore, alert acknowledgement, rollback tabletop                  | Timings and signed checklist               | Pending         |

## Mandatory calculation fixtures

Include leap day, DST-independent Asia/Kolkata dates, overnight shift, public holiday,
week off, paid/unpaid leave, half-day, incomplete attendance, mid-period join/exit,
salary version boundary, rounding boundary, PF applicability and Professional Tax.
The payroll owner independently computes and signs expected values before comparing
Dayflow output.

## Acceptance

Product, HR/payroll, Security and Engineering each sign the release candidate.
Record all Priority 0/1 defects as resolved and rerun affected journeys. A pilot is
not approval for broad rollout until the parallel payroll variance is accepted.
