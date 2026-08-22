const LOCAL_DEVELOPMENT_HOSTS = new Set(['localhost', '127.0.0.1', '[::1]']);

function normalizeOrigin(origin: string): string | undefined {
  try {
    return new URL(origin).origin;
  } catch {
    return undefined;
  }
}

export function isAllowedOrigin(
  origin: string,
  configuredOrigins: string,
  environment: string,
): boolean {
  const normalized = normalizeOrigin(origin);
  if (!normalized) return false;

  const allowed = configuredOrigins
    .split(',')
    .map((value) => normalizeOrigin(value.trim()))
    .filter((value): value is string => Boolean(value));

  if (allowed.includes(normalized)) return true;

  if (environment !== 'production') {
    const url = new URL(normalized);
    return (
      url.protocol === 'http:' && LOCAL_DEVELOPMENT_HOSTS.has(url.hostname)
    );
  }

  return false;
}
