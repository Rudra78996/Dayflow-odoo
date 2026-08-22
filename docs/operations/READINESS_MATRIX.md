# Stages 14–16 readiness matrix

This matrix separates checked-in readiness tooling from evidence that can only be
created in a production-like or production environment. A template or script is
not a passed gate.

| Gate           | Automated evidence                                       | Human/external evidence                                            | Current position                                             |
| -------------- | -------------------------------------------------------- | ------------------------------------------------------------------ | ------------------------------------------------------------ |
| Regression     | `npm run typecheck`, `lint`, `test`, `test:e2e`, `build` | Clean-checkout CI review                                           | Runnable locally/CI                                          |
| Dependencies   | `npm run security:dependencies`, Dependabot              | Security accepts zero open High/Critical                           | Blocked by documented Prisma transitive High                 |
| Secrets/SAST   | Gitleaks and CodeQL; normal TypeScript/ESLint gate       | Threat-model review and independent assessment                     | Workflow ready; assessment pending                           |
| Containers     | Reproducible non-root images; Trivy workflow             | Registry signing/SBOM/provenance policy                            | Images/scans ready; registry policy pending                  |
| API security   | Negative auth/RBAC tests and opt-in ZAP OpenAPI scan     | Authorized OWASP assessment against staging                        | Automation ready; authorized staging run pending             |
| Accessibility  | Lighthouse on public auth routes                         | Keyboard, screen reader, zoom and authenticated routes             | Public automation ready; manual/authenticated review pending |
| Performance    | `npm run test:load-smoke` with explicit p95/error limits | Agreed traffic profile and production-like run                     | Harness ready; targets and representative run pending        |
| Backup/restore | Guarded `backup:postgres` and `restore:postgres` scripts | Neon PITR/export policy, encrypted off-site copy, measured RPO/RTO | Drill tooling ready; provider exercise pending               |
| Observability  | JSON logs, request IDs, liveness/readiness, smoke script | Metrics/traces backend, alert delivery and on-call acknowledgment  | Application signals partial; provider setup pending          |
| UAT            | Traceability worksheet in `UAT.md`                       | Product, HR/payroll, security and engineering signatures           | Pending                                                      |
| Launch         | `npm run smoke` and immutable container examples         | DNS/TLS, secrets, storage, scanner, email, pilot/parallel payroll  | Pending                                                      |
| Stabilization  | Review cadence and variance template                     | Two-release production evidence                                    | Cannot begin before launch                                   |

## Readiness commands

```bash
npm run typecheck
npm run lint
npm test
npm run test:e2e
npm run build
npm run security:dependencies
SMOKE_API_URL=https://api.example/v1 SMOKE_WEB_URL=https://app.example npm run smoke
LOAD_TARGET_URL=https://api.example/v1/health/ready npm run test:load-smoke
```

Do not put credentials in command history. Supply them through the selected secret
manager or an access-restricted environment file.
