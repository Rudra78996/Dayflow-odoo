import process from "node:process";

const apiBase = (
  process.env.SMOKE_API_URL ?? "http://localhost:3001/v1"
).replace(/\/$/, "");
const webBase = (process.env.SMOKE_WEB_URL ?? "http://localhost:3000").replace(
  /\/$/,
  "",
);
const timeoutMs = Number(process.env.SMOKE_TIMEOUT_MS ?? 10_000);

async function request(name, url, expectedStatus, assertion, init = {}) {
  const response = await fetch(url, {
    ...init,
    signal: AbortSignal.timeout(timeoutMs),
    redirect: "manual",
  });
  const body = await response.text();
  if (response.status !== expectedStatus) {
    throw new Error(
      `${name}: expected HTTP ${expectedStatus}, received ${response.status}`,
    );
  }
  await assertion?.(response, body);
  process.stdout.write(`PASS ${name} (${response.status})\n`);
}

await request(
  "API liveness and security headers",
  `${apiBase}/health/live`,
  200,
  (response, body) => {
    if (JSON.parse(body).status !== "ok")
      throw new Error("API liveness payload is invalid");
    if (response.headers.get("x-content-type-options") !== "nosniff") {
      throw new Error(
        "API response is missing X-Content-Type-Options: nosniff",
      );
    }
    if (!response.headers.get("x-frame-options")) {
      throw new Error("API response is missing X-Frame-Options");
    }
  },
);

await request(
  "cross-origin mutation denial",
  `${apiBase}/auth/sign-out`,
  403,
  (_response, body) => {
    if (JSON.parse(body).code !== "CSRF_ORIGIN_DENIED") {
      throw new Error(
        "Cross-origin mutation did not return the expected denial code",
      );
    }
  },
  { method: "POST", headers: { origin: "https://untrusted.invalid" } },
);

await request(
  "API database readiness",
  `${apiBase}/health/ready`,
  200,
  (_response, body) => {
    if (JSON.parse(body).status !== "ready")
      throw new Error("API readiness payload is invalid");
  },
);

await request(
  "anonymous employee denial",
  `${apiBase}/employees`,
  401,
  (response, body) => {
    const requestId = response.headers.get("x-request-id");
    const payload = JSON.parse(body);
    if (!requestId || !payload.requestId || payload.statusCode !== 401) {
      throw new Error(
        "Unauthorized response is missing its structured request ID envelope",
      );
    }
  },
);

await request("web sign-in", `${webBase}/sign-in`, 200, (response, body) => {
  if (
    !response.headers.get("content-type")?.includes("text/html") ||
    !body.includes("Dayflow")
  ) {
    throw new Error("Web sign-in did not return the expected Dayflow HTML");
  }
});

process.stdout.write("Production smoke checks passed.\n");
