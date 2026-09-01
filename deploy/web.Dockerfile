# syntax=docker/dockerfile:1.7
FROM node:26-bookworm-slim@sha256:367679cf9792759492a486e4aa4b421764d71a9546a6dae8aab81a99eb797b3e AS build
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1

COPY package.json package-lock.json ./
COPY apps/api/package.json apps/api/package.json
COPY apps/web/package.json apps/web/package.json
COPY packages/contracts/package.json packages/contracts/package.json
RUN npm ci

COPY apps/web apps/web
COPY packages/contracts packages/contracts

ARG NEXT_PUBLIC_API_URL
ARG DEPLOYMENT_VERSION
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL \
    DEPLOYMENT_VERSION=$DEPLOYMENT_VERSION
RUN npm run build --workspace @dayflow/web

FROM node:26-bookworm-slim@sha256:367679cf9792759492a486e4aa4b421764d71a9546a6dae8aab81a99eb797b3e AS runtime
ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    HOSTNAME=0.0.0.0 \
    PORT=3000
WORKDIR /app

RUN groupadd --system --gid 10001 dayflow \
  && useradd --system --uid 10001 --gid dayflow --home-dir /nonexistent dayflow

COPY --from=build --chown=dayflow:dayflow /app/apps/web/.next/standalone ./
COPY --from=build --chown=dayflow:dayflow /app/apps/web/.next/static ./apps/web/.next/static
COPY --from=build --chown=dayflow:dayflow /app/apps/web/public ./apps/web/public

USER dayflow
EXPOSE 3000
CMD ["node", "apps/web/server.js"]
