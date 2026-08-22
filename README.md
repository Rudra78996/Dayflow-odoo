# Dayflow

Dayflow is a multi-tenant HRMS delivered through the gates in [the implementation plan](docs/IMPLEMENTATION_PLAN.md). The locally implemented product includes identity/RBAC, employees and secure files, schedules, attendance, leave, salary structures, payroll review/finalization, and role-aware dashboards.

## Prerequisites

- Node.js 24
- npm 11; `package-lock.json` is authoritative
- Docker with Compose, or a Neon PostgreSQL database

## Local setup

```bash
cp .env.example .env
npm ci
docker compose up -d postgres
npm run db:migrate:deploy
npm run dev:api
```

In another terminal:

```bash
npm run dev
```

Open `http://localhost:3000`. The API runs on `http://localhost:3001`; Swagger is at `http://localhost:3001/v1/docs`.

The web workspace reads `NEXT_PUBLIC_API_URL` at build time. For local development
the application safely defaults to `http://localhost:3001/v1`; for deployment, set
the final public API URL in the web build environment before running `npm run build`.
See `apps/web/.env.example` for the workspace-specific example.

The local database is exposed on port `5433` by default so it does not collide with a system PostgreSQL installation. Set `DAYFLOW_DB_PORT` to override it and keep both database URLs aligned.

## Neon

Use the pooled Neon URL as `DATABASE_URL` for the running API and the direct URL as `DIRECT_URL` for controlled migrations. The free plan is suitable for development and an early low-volume pilot; production limits and recovery requirements must be reviewed before launch.

## Quality commands

```bash
npm run db:validate
npm run db:migrate:drift
npm run typecheck
npm run lint
npm test
npm run test:e2e
npm run build
npm run smoke
npm run test:load-smoke
```

Object storage and a malware scanner are external. Until configured, the API can create protected file metadata but will not issue an upload URL or falsely mark a file clean.

## Transactional email

Local development defaults to `EMAIL_PROVIDER=console`. Verification, activation,
and password-reset links are printed by the API process, and development responses
also expose a clickable local fallback.

For Gmail inbox delivery, create a Google OAuth client and a refresh token authorized
for the sender mailbox, then set:

```bash
WEB_APP_URL=http://localhost:3000
EMAIL_PROVIDER=gmail-oauth2
EMAIL_FROM=Dayflow <your-account@gmail.com>
GMAIL_SENDER_EMAIL=your-account@gmail.com
GOOGLE_CLIENT_ID=your-client-id
GOOGLE_CLIENT_SECRET=your-client-secret
GOOGLE_REFRESH_TOKEN=your-refresh-token
```

Restart the API after changing these values. Company sign-up sends an administrator
verification email, employee creation sends an activation email, resending an
invitation invalidates the previous link, and forgot-password sends a recovery link.
The OAuth refresh token must belong to `GMAIL_SENDER_EMAIL`. Use environment secrets
in deployment and never commit OAuth credentials.

## Delivery status

The locally testable product scope through Stage 13 is implemented. Stage 14–16
automation and runbooks are present, but production launch and stabilization cannot
pass without external services, UAT, pilot payroll, approvals, and production-time
evidence. See [`docs/BUILD_STATUS.md`](docs/BUILD_STATUS.md) for precise gate status.
