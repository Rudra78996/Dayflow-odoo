import process from "node:process";

const required = [
  "DATABASE_URL",
  "DIRECT_URL",
  "WEB_ORIGIN",
  "WEB_APP_URL",
  "JWT_ACCESS_SECRET",
  "JWT_REFRESH_SECRET",
  "DATA_ENCRYPTION_KEY",
  "OBJECT_STORAGE_REGION",
  "OBJECT_STORAGE_BUCKET",
  "OBJECT_STORAGE_ACCESS_KEY_ID",
  "OBJECT_STORAGE_SECRET_ACCESS_KEY",
  "FILE_SCANNER_WEBHOOK_SECRET",
  "EMAIL_FROM",
  "EMAIL_PROVIDER",
  "GMAIL_SENDER_EMAIL",
  "GOOGLE_CLIENT_ID",
  "GOOGLE_CLIENT_SECRET",
  "GOOGLE_REFRESH_TOKEN",
];
const placeholder =
  /(replace|example\.com|localhost|postgres:postgres|changeme|development)/i;
const errors = [];

for (const key of required) {
  const value = process.env[key]?.trim();
  if (!value) errors.push(`${key} is missing`);
  else if (placeholder.test(value))
    errors.push(`${key} still contains a development/placeholder value`);
}

for (const key of [
  "JWT_ACCESS_SECRET",
  "JWT_REFRESH_SECRET",
  "DATA_ENCRYPTION_KEY",
  "FILE_SCANNER_WEBHOOK_SECRET",
]) {
  if ((process.env[key]?.length ?? 0) < 32)
    errors.push(`${key} must be at least 32 characters`);
}

for (const origin of (process.env.WEB_ORIGIN ?? "")
  .split(",")
  .filter(Boolean)) {
  try {
    if (new URL(origin.trim()).protocol !== "https:")
      errors.push(`WEB_ORIGIN must use HTTPS: ${origin.trim()}`);
  } catch {
    errors.push("WEB_ORIGIN contains an invalid URL");
  }
}

if (process.env.NODE_ENV !== "production")
  errors.push("NODE_ENV must equal production");
if (process.env.COOKIE_SECURE !== "true")
  errors.push("COOKIE_SECURE must equal true");
if (process.env.EMAIL_PROVIDER !== "gmail-oauth2")
  errors.push("EMAIL_PROVIDER must equal gmail-oauth2");
if (
  process.env.DATABASE_URL &&
  process.env.DIRECT_URL &&
  process.env.DATABASE_URL === process.env.DIRECT_URL
) {
  errors.push(
    "DATABASE_URL and DIRECT_URL must use the intended pooled and direct endpoints respectively",
  );
}

if (errors.length) {
  process.stderr.write(
    errors.map((error) => `FAIL ${error}`).join("\n") + "\n",
  );
  process.exitCode = 1;
} else {
  process.stdout.write(
    "Production environment shape passed without printing secret values.\n",
  );
}
