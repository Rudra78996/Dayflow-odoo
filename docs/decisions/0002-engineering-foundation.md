# Decision 0002 — Engineering foundation

Status: Accepted  
Date: 2026-08-22

## Decision

- Use npm workspaces because pnpm was unavailable in the delivery environment. `package-lock.json` is the reproducibility boundary.
- Use Node.js 24, Next.js 16, NestJS 11, TypeScript, Prisma 7, and PostgreSQL 17 compatibility.
- Deploy web and API independently. Run the API in a standard Node.js runtime close to the Neon region.
- Use `@prisma/adapter-pg` for local PostgreSQL and Neon PostgreSQL connection strings.
- Use a Neon pooled connection for runtime and the direct URL for migrations.
- Keep file storage S3-compatible and delivery providers behind environment boundaries.
- Use GitHub Actions as the initial CI gate.

## Consequences

This differs from the plan’s suggested pnpm/Turborepo implementation without changing its logical monorepo boundaries. npm workspaces are sufficient at the current scale; a task runner can be added when build-graph complexity justifies it.
