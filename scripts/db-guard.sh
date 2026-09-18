#!/usr/bin/env bash
# Refuse dangerous SQL before it leaves this machine. Flags, outside comments:
#   - DROP TABLE
#   - TRUNCATE
#   - DELETE FROM ... with no WHERE clause
#
# Which files it checks:
#   as the pre-push hook   every .sql file changed in the commits being pushed
#                          (git passes "<local ref> <local sha> <remote ref>
#                          <remote sha>" lines on stdin)
#   --staged               staged .sql files (for a pre-commit hook)
#   --all                  every migration (to audit the tree)
#
# Comments are stripped first, both `-- line` and `/* block */`, so the DOWN
# sections at the foot of every migration — which spell out the rollback,
# drop table included, inside a block comment — do not trip it.
set -euo pipefail

ZERO=0000000000000000000000000000000000000000
mode="${1:-push}"
files=""

case "$mode" in
  --all)
    files=$(ls supabase/migrations/*.sql 2>/dev/null || true)
    ;;
  --staged)
    files=$(git diff --cached --name-only --diff-filter=ACM -- '*.sql' || true)
    ;;
  *)
    # pre-push: read the ref updates git gives us on stdin
    while read -r local_ref local_sha remote_ref remote_sha; do
      [ -z "${local_sha:-}" ] && continue
      [ "$local_sha" = "$ZERO" ] && continue   # deleting a remote ref: nothing to check
      if [ "$remote_sha" = "$ZERO" ]; then
        # new remote branch: everything not already on any remote
        oldest=$(git rev-list "$local_sha" --not --remotes | tail -n 1)
        [ -z "$oldest" ] && continue
        # the oldest new commit's parent, or the empty tree for a first push
        base=$(git rev-parse --verify -q "${oldest}^" || git hash-object -t tree /dev/null)
        changed=$(git diff --name-only --diff-filter=ACM "$base" "$local_sha" -- '*.sql')
      else
        changed=$(git diff --name-only --diff-filter=ACM "$remote_sha" "$local_sha" -- '*.sql')
      fi
      files=$(printf '%s\n%s' "$files" "$changed")
    done
    ;;
esac

files=$(printf '%s\n' "$files" | sed '/^$/d' | sort -u)
if [ -z "$files" ]; then
  echo "db-guard: no .sql files to check."
  exit 0
fi

fail=0
while IFS= read -r f; do
  [ -f "$f" ] || continue

  # Strip /* block */ and -- line comments, then flatten to one line.
  content=$(perl -0pe 's{/\*.*?\*/}{}gs; s{--[^\n]*}{}g' "$f" | tr '\n' ' ')

  if echo "$content" | grep -iqE 'drop[[:space:]]+table'; then
    echo "db-guard: DROP TABLE found in $f"
    fail=1
  fi

  if echo "$content" | grep -iqE '(^|[^a-z_])truncate([^a-z_]|$)'; then
    echo "db-guard: TRUNCATE found in $f"
    fail=1
  fi

  # Each DELETE FROM up to the end of its statement must contain WHERE.
  deletes=$(echo "$content" | grep -ioE 'delete[[:space:]]+from[^;]*;' || true)
  if [ -n "$deletes" ]; then
    while IFS= read -r stmt; do
      [ -z "$stmt" ] && continue
      if ! echo "$stmt" | grep -iqE '[[:space:]]where[[:space:]]'; then
        echo "db-guard: DELETE FROM without WHERE in $f:"
        echo "          $stmt"
        fail=1
      fi
    done <<< "$deletes"
  fi
done <<< "$files"

if [ "$fail" -ne 0 ]; then
  echo ""
  echo "db-guard: dangerous SQL blocked. If intentional, push with --no-verify"
  echo "          only after a human has read the migration. See CLAUDE.md."
  exit 1
fi

echo "db-guard: $(printf '%s\n' "$files" | wc -l | tr -d ' ') .sql file(s) clean."
exit 0
