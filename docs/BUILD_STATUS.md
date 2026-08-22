# Dayflow build status

Last updated: 2026-08-22

## Current position

The product owner authorized accelerated implementation beyond Stage 5. The locally
testable product scope through Stage 13 is implemented, and the Stage 14–16 readiness
foundation is checked in. Controlled launch and post-launch stabilization remain
external lifecycle gates and are not represented as complete.

“Local gate passed” means the checked-in implementation and repeatable local checks
pass. It does not substitute for a clean-checkout CI run, stakeholder acceptance, or
an external production service that has not yet been connected.

## Stage tracker

| Stage | Deliverable | Status | Gate position |
|---:|---|---|---|
| 0 | Requirements and product decisions | Accepted for implementation | Product-owner approval recorded; HR/payroll, legal/privacy, and recovery assumptions remain production prerequisites |
| 1 | Engineering foundation | Implemented | Local build, static checks, tests, health checks, migration checks, and documented setup pass; hosted CI run remains pending |
| 2 | shadcn UI/UX system | Implemented | Design decision, responsive auth/application shells, semantic states, keyboard-capable primitives, and desktop/mobile visual review complete; stakeholder accessibility review remains pending |
| 3 | Database, tenancy, and audit | Implemented | Empty migration, drift check, repeatable seed, encrypted sensitive storage, tenant-negative test, audit, and outbox foundations pass locally; CI Neon branch/restore exercise remains pending |
| 4 | Authentication and RBAC | Implemented | Two-tenant live API journey, token rotation/reuse revocation, CSRF, session, role, and field-policy checks pass locally; browser journey and external email delivery remain pending |
| 5 | Employees, profiles, and files | Implemented with external gate pending | Directory/profile/masking/tenant/API flows pass locally. Real S3-compatible storage, scanner callback, production-like file test, and browser E2E require service credentials |
| 6 | Schedules, holidays, policies | Implemented locally | Versioned schedules/assignments, scoped holidays, leave policies and defaults pass migration and live-flow checks; HR calendar fixtures and stakeholder review remain |
| 7 | Employee attendance | Implemented locally | Idempotent clock/break state machine, timezone/overnight calculations and employee views pass tests; authenticated browser accessibility E2E remains |
| 8 | Admin attendance and corrections | Implemented locally | Team queries, corrections, locking, audit and payroll-adjustment outbox are implemented; target-organization performance and reviewer UAT remain |
| 9 | Leave balances and requests | Implemented locally | Ledger, allocations, accrual/carry-forward processor, request rules and calendar are implemented; HR-approved fixture/property coverage remains broader than the current suite |
| 10 | Leave approvals and attendance integration | Implemented locally | Versioned decisions, cancellation/reversal and immediate ledger/attendance updates pass a live journey; authenticated browser lifecycle E2E remains |
| 11 | Salary structures | Technical implementation complete | Versioned component graph, Decimal arithmetic, assignment and permission boundary pass the development golden fixture; payroll/HR formula and statutory sign-off remain mandatory |
| 12 | Payroll calculation | Technical implementation complete | Snapshot calculation/review/finalize, blockers, locks and employee summary pass a live ₹50,000 → ₹46,800 fixture; business reconciliation, target batch, worker and adjustment processing remain |
| 13 | Dashboards and product polish | Implemented locally | Role-aware dashboard/navigation and 26 responsive routes compile with shared loading/error/permission states; authenticated visual/accessibility/product acceptance remains |
| 14 | Security, performance, resilience, UAT | Readiness foundation implemented | Threat model, smoke/load/backup/restore/security automation and runbooks exist; High advisory, external scans, production restore, UAT and independent review keep the gate open |
| 15 | Controlled production launch | Tooling ready; not launched | Container/Compose/env/smoke/release/rollback assets exist; providers, DNS/TLS, secrets, telemetry, pilot and approvals are pending |
| 16 | Stabilization and enhancements | Runbook ready; cannot start | Requires a controlled production launch and two-release operational evidence |

## Delivered product scope

- npm workspace with a Next.js 16 web app, NestJS 11 API, shared TypeScript contracts,
  Prisma 7/PostgreSQL schema, Docker development database, and GitHub Actions gate.
- Health/readiness endpoints, validated environment, structured error/request IDs,
  Swagger API documentation, strict type checking, linting, unit/E2E test harnesses,
  deterministic seed, and migration-drift validation.
- shadcn Base UI design system using the `base-nova` composition, self-hosted Geist,
  semantic Dayflow tokens, responsive authentication pages, application shell,
  directory, profile tabs, dialogs, tables, upload states, and protected-data views.
- Organization-scoped identity, users, roles, sessions, verification tokens,
  employees, assignments, profile data, files, audit events, outbox events, and
  idempotency records.
- Company registration, email verification token flow, activation, sign-in by email
  or Login ID, rotating refresh sessions, reuse-family revocation, sign-out, password
  reset/change, role guards, CSRF/CORS/rate limiting, and security audit events.
- Employee creation, transactional Login ID generation, directory search/pagination,
  work summary, resume/skills/certifications, private/bank/statutory data with
  AES-256-GCM storage and masking, optimistic updates, and tenant-safe file intents.
- Five-minute upload intents, server-side object metadata verification, scan callback,
  and clean-only one-minute download links. The API fails closed when storage or the
  scanner is not configured.
- Effective-dated work schedules and employee assignments, holidays, leave types and
  policies, organization defaults, and auditable configuration changes.
- Idempotent clock/break events, materialized attendance, employee/team views,
  correction decisions, timezone/overnight calculations, and payroll locks.
- Explainable leave ledger, allocations, accrual/carry-forward processing, request
  rules, approvals/rejections/cancellation, calendar, and attendance integration.
- Versioned salary structures and assignments, dependency-graph calculation with
  decimal rounding/balancing, payroll snapshots/review/finalization, exceptions, and
  finalized employee summaries.
- Role-aware dashboards and 26 frontend routes with responsive shadcn compositions,
  permission handling, loading, empty, retry, conflict, and route-error states.
- Non-root production containers, hardened Compose reference, smoke/load/env checks,
  guarded backup/restore utilities, security workflows, and operational runbooks.

## Verified evidence

- Typecheck, lint, 23 API unit tests, two API health E2E tests, 26-route web/API
  production build, Prisma
  schema validation, empty-database migration, migration drift, and repeatable seed.
- Live two-organization checks: sign-up → verification → sign-in → Admin employee
  creation; anonymous denial; cross-tenant profile/search denial; ciphertext-at-rest
  assertion; masked bank/statutory responses; refresh-token replay family revocation;
  malicious-origin rejection; and request-ID error envelopes.
- Visual checks at 1440×900 desktop and 390×844 mobile for the authentication system.
- Live disposable-tenant journey: onboarding defaults, clock/replay/clock-out, PTO
  approval with balance and attendance update, salary assignment, payroll calculation
  and finalization, and employee own finalized ₹46,800 net summary.
- Root production smoke 5/5 and bounded readiness load 100/100 with zero errors and
  32.6 ms p95 against the local production API.

## Open gates before production

1. Configure transactional email delivery and process the transactional outbox.
2. Configure private S3-compatible storage and a malware scanner, then run the full
   spoof/oversize/incomplete/expiry/rejection browser matrix in that environment.
3. Run the clean-checkout GitHub Actions workflow and a Neon branch migration/restore
   exercise using the selected region and plan.
4. Complete authenticated browser E2E, keyboard/accessibility review, product-owner
   visual acceptance, and independent security review.
5. Resolve or formally re-review the Prisma CLI transitive High advisory documented
   in `docs/SECURITY_AND_OPERATIONS.md`; there is no open Critical advisory.
6. Obtain HR/payroll sign-off for calendar, leave, salary, proration, rounding and
   statutory rules; configure recurring workers and next-period adjustment handling.
7. Provision telemetry/alerts, exercise target-scale and restore profiles, complete
   the pilot parallel payroll, and obtain release approvals.

## Next implementation boundary

The next safe boundary is production-like Stage 14 validation, not additional feature
scope. Follow `docs/operations/READINESS_MATRIX.md`; do not claim Stage 15 or 16 until
their provider, stakeholder, pilot, and elapsed-production evidence exists.
