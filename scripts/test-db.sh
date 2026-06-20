#!/usr/bin/env bash
#
# Switch the local dev database between PRODUCTION and a Neon TEST BRANCH.
#
# Works by setting NEON_DATABASE_URL (which packages/db/src/client.ts prefers
# over DATABASE_URL) in the three env files. Your production DATABASE_URL lines
# are never modified — "off" just removes the NEON_DATABASE_URL override.
#
#   ./scripts/test-db.sh on '<neon-test-branch-connection-string>'
#   ./scripts/test-db.sh off
#   ./scripts/test-db.sh status
#
# After on/off you MUST restart `pnpm dev` (and any running scripts) — env is
# read at process start.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
KEY="NEON_DATABASE_URL"
FILES=("$ROOT/.env" "$ROOT/apps/web/.env.local" "$ROOT/packages/db/.env")

strip_key() { # remove any existing NEON_DATABASE_URL line from a file
  local f="$1"
  [ -f "$f" ] || return 0
  grep -v "^${KEY}=" "$f" > "$f.tmp" 2>/dev/null || true
  mv "$f.tmp" "$f"
}

host_of() { sed -E 's#.*@([^/?]+).*#\1#' <<<"$1"; } # host only — never echo the secret

case "${1:-}" in
  on)
    URL="${2:-}"
    if [[ -z "$URL" || "$URL" != postgres* ]]; then
      echo "Usage: $0 on '<neon-branch-connection-string starting with postgresql://>'" >&2
      exit 1
    fi
    for f in "${FILES[@]}"; do
      [ -f "$f" ] || { echo "⚠️  missing $f (skipped)"; continue; }
      strip_key "$f"
      printf '\n%s=%s\n' "$KEY" "$URL" >> "$f"
    done
    echo "✅ TEST BRANCH enabled ($(host_of "$URL"))."
    echo "   Restart your dev server:  pnpm dev"
    ;;
  off)
    for f in "${FILES[@]}"; do strip_key "$f"; done
    echo "✅ Back to PRODUCTION (NEON_DATABASE_URL override removed)."
    echo "   Restart your dev server:  pnpm dev"
    ;;
  status)
    for f in "${FILES[@]}"; do
      if [ -f "$f" ] && grep -q "^${KEY}=" "$f" 2>/dev/null; then
        url="$(grep "^${KEY}=" "$f" | head -1 | cut -d= -f2-)"
        echo "  ${f#$ROOT/}  → TEST branch ($(host_of "$url"))"
      else
        echo "  ${f#$ROOT/}  → production"
      fi
    done
    ;;
  *)
    echo "Usage: $0 {on '<url>' | off | status}" >&2
    exit 1
    ;;
esac
