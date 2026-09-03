#!/usr/bin/env bash
# Restore a pg_dump (custom format) into a target database.
# BUILD-PLAN C12 item 2. See docs/RUNBOOK.md for the full procedure.
#
# Usage: scripts/restore.sh <dump-file> <target-conn-string>
# Example (scratch project):
#   scripts/restore.sh qbank-prod-20260903-020000.dump \
#     "postgresql://postgres:pw@db.xxxx.supabase.co:5432/postgres"
set -euo pipefail

DUMP="${1:-}"
TARGET="${2:-}"

if [ -z "$DUMP" ] || [ -z "$TARGET" ]; then
  echo "Usage: scripts/restore.sh <dump-file> <target-conn-string>" >&2
  exit 2
fi
if [ ! -f "$DUMP" ]; then
  echo "restore: dump file not found: $DUMP" >&2
  exit 1
fi

echo "restore: about to restore '$DUMP' into the target database."
echo "restore: this will DROP and recreate objects owned by the dump. Ctrl-C to abort."
echo "restore: target = ${TARGET%%@*}@…(redacted)"

# --clean --if-exists drops existing objects first; --no-owner/--no-privileges
# avoid role mismatches between Supabase projects. Roles/RLS come from migrations.
pg_restore \
  --verbose \
  --clean --if-exists \
  --no-owner \
  --no-privileges \
  --dbname "$TARGET" \
  "$DUMP"

echo "restore: complete. Regenerate types and run the isolation suite before use:"
echo "  supabase gen types typescript --local > src/lib/database.types.ts"
echo "  psql \"\$SUPABASE_DB_URL\" -f supabase/tests/isolation.test.sql"
