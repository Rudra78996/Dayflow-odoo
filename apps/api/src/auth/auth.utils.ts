import { createHash, randomBytes } from 'node:crypto';

export function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

export function normalizeNamePart(value: string) {
  return value
    .normalize('NFKD')
    .replace(/[^a-zA-Z]/g, '')
    .toUpperCase()
    .slice(0, 2)
    .padEnd(2, 'X');
}

export function buildLoginId(input: {
  companyPrefix: string;
  firstName: string;
  lastName: string;
  joiningYear: number;
  sequence: number;
}) {
  return [
    input.companyPrefix.toUpperCase(),
    normalizeNamePart(input.firstName),
    normalizeNamePart(input.lastName),
    input.joiningYear.toString(),
    input.sequence.toString().padStart(4, '0'),
  ].join('');
}

export function createOpaqueToken() {
  return randomBytes(32).toString('base64url');
}

export function hashOpaqueToken(token: string) {
  return createHash('sha256').update(token).digest('hex');
}

export function splitFullName(name: string) {
  const parts = name.trim().split(/\s+/);
  const firstName = parts.shift() ?? 'Admin';
  const lastName = parts.pop() ?? 'User';
  return { firstName, lastName };
}

export function slugify(value: string) {
  const base = value
    .normalize('NFKD')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 90);
  return base || 'company';
}
