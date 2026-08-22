# Observability, backup and recovery runbook

## Provisional service objectives

These targets require product/engineering approval and a representative load test:

- Monthly API availability: 99.9%, excluding an approved maintenance window.
- Interactive API p95: 500 ms and error rate below 1% for the agreed normal profile.
- Health checks: liveness does not touch dependencies; readiness fails when the
  database is unavailable.
- Initial recovery proposal: database RPO 24 hours and RTO 4 hours for an early
  pilot. Payroll owners must approve tighter targets before payroll reliance.

## Required telemetry

Collect API request count, duration and status by normalized route; authentication
failure/lockout/refresh-reuse events; DB pool saturation/query duration; outbox age,
retry and dead-letter count; upload/scan state age; process CPU/memory/restarts;
Next.js response/Core Web Vitals; and business integrity counters for open clock
events, pending corrections, leave decision failures and payroll exceptions.

Logs must preserve timestamp, level, service, deployment version, environment,
request ID and safe event metadata. Never record cookies, authorization headers,
passwords/tokens, raw bank/PAN/UAN values, file bytes or unrestricted request bodies.

## Minimum alerts

| Signal                | Initial trigger                          | Response                                         |
| --------------------- | ---------------------------------------- | ------------------------------------------------ |
| Readiness failure     | 3 consecutive checks                     | Page service owner; stop rollout                 |
| 5xx rate              | >2% for 5 minutes                        | Page on-call; correlate deployment/request IDs   |
| API latency           | p95 >1 s for 10 minutes                  | Ticket/page based on user impact                 |
| Auth refresh reuse    | Any confirmed event                      | Security alert and session investigation         |
| Outbox oldest pending | >10 minutes                              | Page integration owner; inspect provider/retries |
| File scan pending     | >15 minutes                              | Warn operations; quarantine remains closed       |
| Backup missing        | No successful backup within approved RPO | Page data owner                                  |
| Restore drill overdue | No evidence in 90 days                   | Block production-readiness review                |

Route alerts to a named on-call schedule and test delivery/acknowledgement before a
pilot. Dashboards without a responder do not satisfy the gate.

## Backup procedure

1. Prefer the selected Neon plan’s point-in-time recovery when it meets approved
   RPO/RTO; also maintain an encrypted logical backup outside the database account.
2. Use a direct, least-privilege backup URL supplied through a secret manager.
3. Run `BACKUP_SOURCE_DATABASE_URL=... BACKUP_ENCRYPTION_RECIPIENT=... npm run backup:postgres`.
4. Upload the `.age` file and checksum to an immutable, access-logged backup store.
5. Record timestamp, schema migration, size, checksum, operator/job and retention
   expiry. A successful command without a restore test is not recovery evidence.
6. Back up object bytes and file metadata consistently; file recovery is a separate
   gate from PostgreSQL recovery.

## Restore rehearsal

1. Provision a new disposable database in the intended recovery region/account.
2. Download backup and checksum without exposing credentials in logs.
3. Set `RESTORE_TARGET_DATABASE_URL` to that database; never use the live runtime URL.
4. Set `BACKUP_FILE` and `RESTORE_CONFIRMATION=RESTORE_INTO_DISPOSABLE_DATABASE`, then
   run `npm run restore:postgres`.
5. Run migrations only if the release runbook calls for forward recovery, then run
   readiness, tenant-isolation and representative record-count/integrity checks.
6. Restore a sample object and verify its checksum and CLEAN scan state.
7. Record elapsed time, recovery point, data gaps, failures and corrective owner.
8. Destroy the disposable environment through the provider’s approved process.

The restore script intentionally refuses the configured runtime `DATABASE_URL` and
requires an explicit destructive-operation marker.
