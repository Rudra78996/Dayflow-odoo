# Threat model and abuse cases

## Scope and trust boundaries

The browser is untrusted. It communicates with the public Next.js service and the
public NestJS API over TLS. The API is the authorization boundary and talks to
Neon PostgreSQL, private object storage, the malware scanner and transactional
email provider. CI, the container registry, secret manager and operator access are
separate privileged boundaries.

High-value assets are authentication secrets and sessions; organization isolation;
private, bank, statutory and salary data; attendance/leave/payroll integrity; file
contents; encryption keys; audit history; backups; and deployment credentials.

## Priority abuse cases

| Threat                                               | Required control/evidence                                                                             | Residual/open work                                                         |
| ---------------------------------------------------- | ----------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------- |
| Cross-tenant object access or ID enumeration         | Organization is derived from authenticated session; negative tests for list/detail/file endpoints     | Extend authorization matrix to every Stage 6–12 endpoint                   |
| Employee escalates to HR/Admin or grants roles       | Server-side role/resource policy; immutable audit event                                               | Test every mutation and nested resource, including stale sessions          |
| CSRF/cross-origin authenticated mutation             | HttpOnly SameSite cookies, exact production origin allowlist, mutation origin check                   | Dynamic test through production proxy                                      |
| Credential stuffing/token theft                      | Argon2id, throttling, short access token, rotating hashed refresh tokens, replay-family revocation    | Central rate-limit store and alert thresholds before multi-instance launch |
| Reset/activation token replay or account enumeration | Single-use hashed expiring token and generic public errors                                            | External email link and redirect review                                    |
| Sensitive data in logs/errors/analytics              | Masked API fields, encrypted values, structured errors                                                | Log sink sampling and DLP review                                           |
| Malicious or spoofed file                            | Signed intent, allowlist/size/checksum, object HEAD validation, scanner callback, CLEAN-only download | Real storage/scanner E2E and archive/polyglot test corpus                  |
| Scanner callback forgery                             | Dedicated secret and constant-time comparison                                                         | Network restriction/key rotation procedure                                 |
| Payroll/leave/attendance tampering                   | RBAC, optimistic concurrency, immutable snapshots/ledger/audit                                        | Domain goldens and privileged-action recent-auth gates                     |
| Injection or unsafe formulas                         | DTO validation and parameterized ORM; formulas must never evaluate JavaScript                         | OWASP API scan and formula fuzz tests                                      |
| Database or backup disclosure                        | TLS, least-privilege roles, application encryption, encrypted backup                                  | KMS/secret-manager and access-log evidence                                 |
| Denial of service/resource exhaustion                | API throttling, proxy limits, upload caps, readiness, load gate                                       | Distributed limiter, CDN/WAF and agreed capacity profile                   |
| Dependency/build compromise                          | Lockfile, `npm ci`, Dependabot, secret and image scanning                                             | Pin actions/images by digest, SBOM/signing and resolve all High findings   |
| Audit deletion or repudiation                        | Application users cannot update audit events; request IDs                                             | Export/retention and privileged DB access monitoring                       |

## Required security test roles

For each protected endpoint exercise anonymous, Admin, HR Officer, self Employee,
other Employee in the same organization, and an authenticated user from another
organization. Check both HTTP status and response-field redaction. Repeat with a
valid object ID from the wrong tenant, malformed IDs, stale versions, replayed
idempotency keys, malicious origins and revoked sessions.

## Sign-off rule

Stage 14 cannot pass with an open Critical/High finding. Exceptions require a named
owner, expiry, exploitability analysis, compensating control and Security approval;
the current Prisma tooling advisory is therefore a release blocker until resolved
or formally re-reviewed under that process.
