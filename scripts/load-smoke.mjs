import { performance } from "node:perf_hooks";
import process from "node:process";

const target =
  process.env.LOAD_TARGET_URL ?? "http://localhost:3001/v1/health/ready";
// The API's single-instance development limiter permits 120 requests/minute.
// Keep the default smoke profile below that policy ceiling; larger agreed
// profiles must model multiple authorized clients and the production limiter.
const requests = Number(process.env.LOAD_REQUESTS ?? 100);
const concurrency = Number(process.env.LOAD_CONCURRENCY ?? 10);
const maxP95Ms = Number(process.env.LOAD_MAX_P95_MS ?? 500);
const maxErrorRate = Number(process.env.LOAD_MAX_ERROR_RATE ?? 0.01);
const timeoutMs = Number(process.env.LOAD_TIMEOUT_MS ?? 5_000);

if (
  ![requests, concurrency, maxP95Ms, timeoutMs].every(Number.isFinite) ||
  requests < 1 ||
  concurrency < 1
) {
  throw new Error("Load settings must be positive numbers");
}

const durations = [];
let failures = 0;
let cursor = 0;
const statusCounts = new Map();

async function worker() {
  while (true) {
    const index = cursor++;
    if (index >= requests) return;
    const started = performance.now();
    try {
      const response = await fetch(target, {
        cache: "no-store",
        signal: AbortSignal.timeout(timeoutMs),
      });
      statusCounts.set(
        response.status,
        (statusCounts.get(response.status) ?? 0) + 1,
      );
      if (!response.ok) failures += 1;
      await response.arrayBuffer();
    } catch {
      failures += 1;
    } finally {
      durations.push(performance.now() - started);
    }
  }
}

await Promise.all(
  Array.from({ length: Math.min(concurrency, requests) }, worker),
);
durations.sort((a, b) => a - b);
const percentile = (value) =>
  durations[
    Math.min(durations.length - 1, Math.ceil(durations.length * value) - 1)
  ];
const p50 = percentile(0.5);
const p95 = percentile(0.95);
const p99 = percentile(0.99);
const errorRate = failures / requests;

process.stdout.write(
  JSON.stringify(
    {
      target,
      requests,
      concurrency,
      failures,
      errorRate,
      statuses: Object.fromEntries(
        [...statusCounts.entries()].sort(([a], [b]) => a - b),
      ),
      p50Ms: p50,
      p95Ms: p95,
      p99Ms: p99,
    },
    null,
    2,
  ) + "\n",
);

if (p95 > maxP95Ms || errorRate > maxErrorRate) {
  throw new Error(
    `Load gate failed: p95=${p95.toFixed(1)}ms (max ${maxP95Ms}), errorRate=${errorRate} (max ${maxErrorRate})`,
  );
}
