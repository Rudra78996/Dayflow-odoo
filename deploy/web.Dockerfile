# syntax=docker/dockerfile:1.7
FROM node:24-bookworm-slim@sha256:3638d9a6fe4030bd716be989438248074489337ba3275657f93595428be4fc03 AS build
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

FROM node:24-bookworm-slim@sha256:3638d9a6fe4030bd716be989438248074489337ba3275657f93595428be4fc03 AS runtime
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
