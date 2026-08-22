# Release, pilot and rollback runbook

## Entry criteria

- All migrations reviewed and dry-run against a production-like snapshot.
- CI is green and the release-readiness workflow has no Critical/High finding.
- UAT, accessibility, threat-model and payroll golden fixtures are signed.
- Production environment validation passes without printing secrets.
- Neon capacity/recovery, private storage/scanner, email, DNS/TLS, telemetry,
  alert routing and on-call ownership are verified.
- Immutable API/Web image digests, SBOM/provenance and previous known-good digests
  are recorded. Never deploy mutable `latest` tags.

## Deployment sequence

1. Announce change window and freeze conflicting Admin data changes if required.
2. Confirm recent encrypted backup and successful restore evidence.
3. Run backward-compatible/expand migrations using `DIRECT_URL` from a controlled
   migration job; application instances must not migrate on startup.
4. Deploy API canary, wait for readiness, then run health and anonymous-denial smoke.
5. Deploy Web using one already-built artifact. `NEXT_PUBLIC_API_URL` is fixed at
   build time; all replicas need the same deployment version and server-action key.
6. Run authenticated Admin/HR/Employee smoke for organization isolation, employee,
   attendance, leave and salary redaction. Include storage scan and email delivery.
7. Observe error, latency, DB pool, outbox, scan and business-integrity metrics.
8. Admit only the pilot group. Run payroll in parallel with the trusted manual
   process; the system is not authoritative until payroll owner approval.
9. Expand only through a recorded Product/HR/Engineering exit decision.

## Stop/rollback criteria

Immediately stop rollout for suspected cross-tenant/salary disclosure, session
bypass, corrupt or duplicate leave/payroll decisions, unexplained payroll variance,
migration integrity failure, inability to restore, sustained 5xx above 2%, or p95
above 1 second for ten minutes with material impact.

Rollback means routing traffic to the recorded previous image digests. Do not roll
back a database migration blindly: prefer forward repair, and use a reviewed
down-migration only when proven safe on a copy. If the new code wrote data the old
code cannot understand, disable affected writes and perform a forward fix. Record
operator, timestamps, release IDs, query/request IDs and decision owner.

## Post-deploy verification

Run:

```bash
SMOKE_API_URL=https://api.example/v1 SMOKE_WEB_URL=https://app.example npm run smoke
```

Then perform authenticated checks, alert delivery/acknowledgement, one email and
one clean/rejected file flow. Confirm no secrets or personal data appear in logs.
