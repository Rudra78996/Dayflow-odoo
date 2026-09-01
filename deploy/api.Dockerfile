# syntax=docker/dockerfile:1.7
FROM node:26-bookworm-slim@sha256:367679cf9792759492a486e4aa4b421764d71a9546a6dae8aab81a99eb797b3e AS production-dependencies
WORKDIR /app
RUN apt-get update \
  && apt-get install --yes --no-install-recommends ca-certificates openssl \
  && rm -rf /var/lib/apt/lists/*

COPY package.json package-lock.json ./
COPY apps/api/package.json apps/api/package.json
COPY apps/web/package.json apps/web/package.json
COPY packages/contracts/package.json packages/contracts/package.json
RUN npm ci --omit=dev

FROM production-dependencies AS build
RUN npm ci

COPY apps/api apps/api
COPY packages/contracts packages/contracts
RUN DIRECT_URL=postgresql://build:build@127.0.0.1:5432/build npm run db:generate --workspace @dayflow/api \
  && npm run build --workspace @dayflow/api

FROM build AS migration
ENV NODE_ENV=production
CMD ["npm", "run", "db:migrate:deploy", "--workspace", "@dayflow/api"]

FROM node:26-bookworm-slim@sha256:367679cf9792759492a486e4aa4b421764d71a9546a6dae8aab81a99eb797b3e AS runtime
ENV NODE_ENV=production \
    API_PORT=3001
WORKDIR /app

RUN apt-get update \
  && apt-get install --yes --no-install-recommends ca-certificates openssl \
  && rm -rf /var/lib/apt/lists/* \
  && groupadd --system --gid 10001 dayflow \
  && useradd --system --uid 10001 --gid dayflow --home-dir /nonexistent dayflow

COPY --from=build --chown=dayflow:dayflow /app/package.json /app/package-lock.json ./
COPY --from=production-dependencies --chown=dayflow:dayflow /app/node_modules ./node_modules
COPY --from=build --chown=dayflow:dayflow /app/apps/api/package.json ./apps/api/package.json
COPY --from=build --chown=dayflow:dayflow /app/apps/api/dist ./apps/api/dist

USER dayflow
EXPOSE 3001
CMD ["node", "apps/api/dist/src/main.js"]
