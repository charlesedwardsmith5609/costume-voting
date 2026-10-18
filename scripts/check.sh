#!/usr/bin/env bash
# Validation gate: typecheck, tests, production build, client bundle secret scan.
# Usage: bash scripts/check.sh
set -u
cd "$(dirname "$0")/.." || exit 2

# Non-interactive shells skip the nvm block in ~/.bashrc; load it if node is missing.
if ! command -v node >/dev/null 2>&1 && [ -s "${NVM_DIR:-$HOME/.nvm}/nvm.sh" ]; then
  # shellcheck disable=SC1091
  . "${NVM_DIR:-$HOME/.nvm}/nvm.sh" >/dev/null
fi
command -v node >/dev/null 2>&1 || { echo "FAIL: node not found (need Node 22+)"; exit 2; }
[ -d node_modules ] || npm ci --no-fund --no-audit || exit 2

fail=0
stage() { printf '\n== %s\n' "$1"; }

stage "typecheck"
if npx --no-install next typegen >/dev/null && npx --no-install tsc --noEmit; then echo "PASS"; else echo "FAIL"; fail=1; fi

stage "test"
if npx --no-install vitest run; then echo "PASS"; else echo "FAIL"; fail=1; fi

stage "build"
if npx --no-install next build; then echo "PASS"; else echo "FAIL"; fail=1; fi

stage "client bundle secrets"
# Server-only secret names, any Supabase secret key (sb_secret_...), and any legacy JWT with role
# service_role must never appear in browser JS; if the service role key value is available (env
# or .env.local), it must not either.
if [ ! -d .next/static ]; then
  echo "FAIL: .next/static missing (build failed?)"; fail=1
else
  key="${SUPABASE_SERVICE_ROLE_KEY:-}"
  if [ -z "$key" ] && [ -f .env.local ]; then
    key=$(sed -n 's/^SUPABASE_SERVICE_ROLE_KEY=//p' .env.local | tr -d '"'"'"'\r' | head -n1)
  fi
  leaks=$(grep -rlE 'SUPABASE_SERVICE_ROLE_KEY|SESSION_SECRET|ADMIN_PASSWORD|sb_secret_[A-Za-z0-9_-]{16,}' .next/static 2>/dev/null)
  # Legacy JWT-format keys: the anon JWT may legitimately ship to the browser, so decode each
  # JWT payload and flag only role "service_role".
  jwt_re='eyJ[A-Za-z0-9_-]{8,}\.eyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}'
  for f in $(grep -rlE "$jwt_re" .next/static 2>/dev/null); do
    for t in $(grep -ohE "$jwt_re" "$f" | sort -u); do
      p=$(printf '%s' "$t" | cut -d. -f2 | tr '_-' '/+')
      while [ $(( ${#p} % 4 )) -ne 0 ]; do p="$p="; done
      if printf '%s' "$p" | base64 -d 2>/dev/null | grep -qE '"role"[[:space:]]*:[[:space:]]*"service_role"'; then
        leaks=$(printf '%s\n%s' "$leaks" "$f")
      fi
    done
  done
  if [ -n "$key" ]; then
    leaks=$(printf '%s\n%s' "$leaks" "$(grep -rlF -- "$key" .next/static 2>/dev/null)" | sed '/^$/d' | sort -u)
  else
    leaks=$(printf '%s\n' "$leaks" | sed '/^$/d' | sort -u)
    echo "note: SUPABASE_SERVICE_ROLE_KEY not set; checked secret names and key patterns only"
  fi
  if [ -n "$leaks" ]; then echo "FAIL: secret found in client bundle:"; echo "$leaks"; fail=1; else echo "PASS"; fi
fi

echo
if [ "$fail" -eq 0 ]; then echo "CHECK PASSED"; else echo "CHECK FAILED"; fi
exit "$fail"
