# Production container reference

These files are deployment inputs, not a one-command production launch. Build once,
scan/sign the images, push immutable digests, and promote those same digests.

```bash
docker build -f deploy/api.Dockerfile -t registry.example/dayflow-api:VERSION .
docker build \
  --build-arg NEXT_PUBLIC_API_URL=https://api.example/v1 \
  --build-arg DEPLOYMENT_VERSION=VERSION \
  -f deploy/web.Dockerfile \
  -t registry.example/dayflow-web:VERSION .
```

Copy `production.api.env.example` to an access-restricted location populated by the
secret manager. Validate its shape in the same injected environment:

```bash
npm run security:env
```

Set `DAYFLOW_API_IMAGE` and `DAYFLOW_WEB_IMAGE` to registry digests, and
`DAYFLOW_API_ENV_FILE` to the absolute or Compose-relative API environment path.
Then validate before applying:

```bash
docker compose -f deploy/docker-compose.production.example.yml config
```

The Compose ports bind only to loopback because a TLS-terminating reverse proxy is
required. Configure proxy request-size/timeout/rate limits and forward the original
scheme/IP safely. Do not expose the API or Next.js process directly to the internet.

The web image embeds `NEXT_PUBLIC_API_URL` at build time. `DEPLOYMENT_VERSION` enables
Next.js rolling-deployment skew protection. Use the same Web artifact and deployment
version across replicas. If Server Actions are introduced, configure one stable
`NEXT_SERVER_ACTIONS_ENCRYPTION_KEY` for the build/replica set.

Neon, object storage, malware scanning, email, secrets and telemetry remain external;
their credentials are deliberately absent from these examples.
