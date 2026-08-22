# Incident response and support runbook

## Severity

- SEV-0: confirmed cross-tenant/private/payroll disclosure, destructive corruption,
  active credential compromise, or payroll output used incorrectly at scale.
- SEV-1: authentication bypass, material integrity issue, sustained outage, failed
  recovery, or pilot payroll variance without a safe workaround.
- SEV-2: degraded workflow with workaround or isolated incorrect state.
- SEV-3: low-impact defect or support request.

## Response

1. Acknowledge, assign Incident Commander and start an access-controlled timeline.
2. Protect people/data first: stop rollout, disable affected writes or revoke
   sessions/keys. Preserve audit, request IDs and provider logs.
3. Identify affected organizations/users/periods without broadening data access.
4. Contain with a reversible config/traffic action; do not edit payroll/ledger rows
   manually without HR/payroll and Engineering approval plus an audit record.
5. Recover through the release/rollback runbook; validate tenant isolation and
   calculation integrity before reopening traffic.
6. Coordinate legally reviewed customer/privacy communication when personal data
   may be involved. Do not promise notification timelines before obligations are set.
7. Write a blameless review with cause, impact, detection gap, corrective owners and
   due dates. Add a regression test and verify the action, not only the ticket.

For payroll corrections, preserve the finalized snapshot and create an explicit
next-period adjustment unless the approved domain policy permits privileged reopen.
