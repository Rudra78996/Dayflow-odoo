# Privacy and retention decisions

Retention is not yet legally approved. The following inventory must be completed by
the data owner and counsel before launch; no destructive cleanup job should be
enabled from an unapproved default.

| Data                            | Proposed operational treatment                          | Decision needed                                          |
| ------------------------------- | ------------------------------------------------------- | -------------------------------------------------------- |
| Active sessions                 | Revoke on reset/deactivation; expire refresh records    | Deletion window after expiry                             |
| Verification/reset tokens       | Hash, single use, short expiry                          | Cleanup interval                                         |
| Employee/private/bank/statutory | Encrypt sensitive values; deactivate rather than delete | Employment/statutory retention and data-subject workflow |
| Attendance/leave/payroll        | Immutable history/adjustments                           | Jurisdiction-specific minimum/maximum retention          |
| Files                           | Private, scanned, short-lived links                     | Category-specific retention and legal hold               |
| Audit logs                      | Append-only, redacted                                   | Security/statutory retention and restricted viewers      |
| Backups                         | Encrypted, immutable, restore-tested                    | Retention tiers, deletion and legal hold                 |

Before production document controller/processor roles, lawful purposes, subprocessors,
data residency, access/export/correction/deletion handling, breach notification,
backup deletion limitations and key destruction. Support exports must be scoped to
one organization and encrypted; never send raw HR records through ordinary tickets.
