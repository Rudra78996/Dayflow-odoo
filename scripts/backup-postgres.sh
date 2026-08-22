#!/usr/bin/env bash
set -Eeuo pipefail
umask 077

: "${BACKUP_SOURCE_DATABASE_URL:?Set BACKUP_SOURCE_DATABASE_URL to the direct PostgreSQL URL}"
command -v pg_dump >/dev/null || { echo "pg_dump is required (PostgreSQL 17 client recommended)." >&2; exit 1; }

backup_directory="${BACKUP_DIRECTORY:-./backups}"
timestamp="$(date -u +%Y%m%dT%H%M%SZ)"
mkdir -p "$backup_directory"
temporary_dump="$(mktemp "$backup_directory/dayflow-$timestamp.XXXXXX.dump")"
trap 'rm -f "$temporary_dump"' EXIT

pg_dump \
  --dbname="$BACKUP_SOURCE_DATABASE_URL" \
  --format=custom \
  --compress=9 \
  --no-owner \
  --no-privileges \
  --file="$temporary_dump"

if [[ -n "${BACKUP_ENCRYPTION_RECIPIENT:-}" ]]; then
  command -v age >/dev/null || { echo "age is required for encrypted backups" >&2; exit 1; }
  final_file="$backup_directory/dayflow-$timestamp.dump.age"
  age --recipient "$BACKUP_ENCRYPTION_RECIPIENT" --output "$final_file" "$temporary_dump"
else
  [[ "${ALLOW_UNENCRYPTED_BACKUP:-false}" == "true" ]] || {
    echo "Set BACKUP_ENCRYPTION_RECIPIENT, or ALLOW_UNENCRYPTED_BACKUP=true only for an isolated local drill." >&2
    exit 1
  }
  final_file="$backup_directory/dayflow-$timestamp.dump"
  mv "$temporary_dump" "$final_file"
fi

sha256sum "$final_file" >"$final_file.sha256"
echo "Backup created: $final_file"
echo "Checksum created: $final_file.sha256"
