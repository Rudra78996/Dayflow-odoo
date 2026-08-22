#!/usr/bin/env bash
set -Eeuo pipefail

: "${RESTORE_TARGET_DATABASE_URL:?Set RESTORE_TARGET_DATABASE_URL to a disposable restore database}"
: "${BACKUP_FILE:?Set BACKUP_FILE to a .dump or .dump.age file}"
command -v pg_restore >/dev/null || { echo "pg_restore is required (PostgreSQL 17 client recommended)." >&2; exit 1; }
command -v psql >/dev/null || { echo "psql is required (PostgreSQL 17 client recommended)." >&2; exit 1; }

required_confirmation="RESTORE_INTO_DISPOSABLE_DATABASE"
if [[ "${RESTORE_CONFIRMATION:-}" != "$required_confirmation" ]]; then
  echo "Refusing restore. Set RESTORE_CONFIRMATION=$required_confirmation after checking the target." >&2
  exit 1
fi
if [[ -n "${DATABASE_URL:-}" && "$RESTORE_TARGET_DATABASE_URL" == "$DATABASE_URL" ]]; then
  echo "Refusing to restore into DATABASE_URL. Use a separate disposable database." >&2
  exit 1
fi
[[ -f "$BACKUP_FILE" ]] || { echo "Backup file not found: $BACKUP_FILE" >&2; exit 1; }
[[ -f "$BACKUP_FILE.sha256" ]] && sha256sum --check "$BACKUP_FILE.sha256"

restore_input="$BACKUP_FILE"
temporary_directory=""
if [[ "$BACKUP_FILE" == *.age ]]; then
  command -v age >/dev/null || { echo "age is required to decrypt this backup" >&2; exit 1; }
  temporary_directory="$(mktemp -d)"
  trap 'rm -rf "$temporary_directory"' EXIT
  restore_input="$temporary_directory/dayflow.dump"
  age --decrypt --output "$restore_input" "$BACKUP_FILE"
fi

started_at="$(date +%s)"
pg_restore \
  --dbname="$RESTORE_TARGET_DATABASE_URL" \
  --clean \
  --if-exists \
  --exit-on-error \
  --no-owner \
  --no-privileges \
  "$restore_input"
psql "$RESTORE_TARGET_DATABASE_URL" --set=ON_ERROR_STOP=1 --tuples-only --command='SELECT COUNT(*) FROM "Organization";'
finished_at="$(date +%s)"

echo "Restore drill completed in $((finished_at - started_at)) seconds. Record this result against the approved RTO."
