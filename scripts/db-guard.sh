#!/usr/bin/env bash
# Scan staged .sql files and refuse dangerous statements.
# Wired into the pre-push hook. Exits non-zero on:
#   - DROP TABLE
#   - TRUNCATE
#   - DELETE FROM ... with no WHERE clause
set -euo pipefail

staged_sql=$(git diff --cached --name-only --diff-filter=ACM | grep -E '\.sql$' || true)

if [ -z "$staged_sql" ]; then
  echo "db-guard: no staged .sql files."
  exit 0
fi

fail=0

for f in $staged_sql; do
  [ -f "$f" ] || continue

  # Strip SQL line comments so a commented example does not trip the guard.
  content=$(sed 's/--.*$//' "$f")

  if echo "$content" | grep -iqE 'drop[[:space:]]+table'; then
    echo "db-guard: DROP TABLE found in $f"
    fail=1
  fi

  if echo "$content" | grep -iqE 'truncate'; then
    echo "db-guard: TRUNCATE found in $f"
    fail=1
  fi

  # DELETE FROM <something> not followed (before ;) by WHERE.
  # Flatten to one line per statement, then check each DELETE.
  deletes=$(echo "$content" | tr '\n' ' ' | grep -ioE 'delete[[:space:]]+from[^;]*;' || true)
  if [ -n "$deletes" ]; then
    while IFS= read -r stmt; do
      [ -z "$stmt" ] && continue
      if ! echo "$stmt" | grep -iqE 'where'; then
        echo "db-guard: DELETE FROM without WHERE in $f:"
        echo "          $stmt"
        fail=1
      fi
    done <<< "$deletes"
  fi
done

if [ "$fail" -ne 0 ]; then
  echo ""
  echo "db-guard: dangerous SQL blocked. If intentional, run with --no-verify"
  echo "          only after a human has read the migration. See CLAUDE.md."
  exit 1
fi

echo "db-guard: staged SQL clean."
exit 0
