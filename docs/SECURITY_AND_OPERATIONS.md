# Security and operations notes — implemented product and readiness foundation

- Authentication uses short-lived cookie JWTs plus opaque, hashed, rotating refresh tokens. Reuse of a rotated token revokes the whole token family.
- Cookies are HttpOnly, SameSite=Lax, and Secure in production. Mutation requests with a mismatched `Origin` are rejected.
- Organization identity comes only from the validated session. Employee, file, assignment, department, manager, and location queries are organization-scoped.
- Passwords use Argon2id. Verification/reset tokens are single-use hashes with expiry.
- Bank, PAN, UAN, and similar identifiers use AES-256-GCM at rest and are only returned masked.
- File uploads use five-minute signed intents, type/size/checksum constraints, post-upload object verification, an explicit malware-scan callback, and clean-only one-minute downloads.
- Request IDs are returned in response headers and error envelopes. Nest logs are JSON in the production entrypoint.
- Audit/outbox records are written in the same transactions as core onboarding and employee mutations.
- Attendance and leave mutations use organization-scoped advisory locks, idempotency,
  effective-date rules, and auditable decisions.
- Salary configuration and payroll runs are Admin-only. Calculations use Prisma
  Decimal values, versioned assignments, immutable finalized snapshots, blocking
  exceptions, recent-auth finalization, and employee self-only finalized summaries.

## External production dependencies

Phase-5 code is ready for an S3-compatible bucket and scanner, but the production-like file gate cannot pass until credentials and a real scanner callback are supplied. Transactional email is represented by outbox events; a production email worker/provider is required before public launch.

## Dependency advisory

Prisma 7.9.1 currently brings `deepmerge-ts@7.1.5` through its CLI configuration package. npm reports GHSA-ggr8-5vv4-36mx as High and suggests a breaking downgrade to Prisma 6.12. This path is build/migration tooling, not request data processing. CI fails on Critical advisories; this High exception must be removed when Prisma publishes a compatible fix and reconsidered before production.

## Readiness runbooks

Stage 14–16 evidence templates, threat model, recovery, incident, privacy, UAT,
release/rollback, and stabilization procedures live in `docs/operations/`. They are
deliberately marked pending where production credentials, provider configuration,
measured restore/load evidence, or stakeholder sign-off is required.
