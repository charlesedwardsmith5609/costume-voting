# Sourced by dev-test.sh and start-test.sh. Maps TEST_SUPABASE_URL and
# TEST_SUPABASE_SERVICE_ROLE_KEY (from the environment, else .env.local) onto
# NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY for the calling process only. Next.js
# gives variables already in the environment priority over .env.local, so the production values
# in .env.local are never used by these scripts and never changed.
# $1 is the script name used in messages.

# Reads one KEY=value from .env.local, without sourcing the file.
from_file() {
  [ -f .env.local ] || return 0
  sed -n "s/^$1=//p" .env.local | tr -d '"'"'"'\r' | head -n1
}

test_url="${TEST_SUPABASE_URL:-$(from_file TEST_SUPABASE_URL)}"
test_key="${TEST_SUPABASE_SERVICE_ROLE_KEY:-$(from_file TEST_SUPABASE_SERVICE_ROLE_KEY)}"
prod_url="${NEXT_PUBLIC_SUPABASE_URL:-$(from_file NEXT_PUBLIC_SUPABASE_URL)}"
prod_key="${SUPABASE_SERVICE_ROLE_KEY:-$(from_file SUPABASE_SERVICE_ROLE_KEY)}"

[ -n "$test_url" ] && [ -n "$test_key" ] || {
  echo "$1: TEST_SUPABASE_URL and TEST_SUPABASE_SERVICE_ROLE_KEY must be set (env or .env.local)" >&2
  exit 2
}
# Same rule as the test suite's guard: the test project must not be production.
if [ "${test_url%/}" = "${prod_url%/}" ] || [ "$test_key" = "$prod_key" ]; then
  echo "$1: refusing to start: the TEST_SUPABASE_* values match the production values" >&2
  exit 2
fi

host="${test_url#*://}"
echo "$1: using the TEST Supabase project (${host%%/*})"
echo "$1: bash scripts/check.sh resets this project; don't run it while testing"

export NEXT_PUBLIC_SUPABASE_URL="$test_url" SUPABASE_SERVICE_ROLE_KEY="$test_key"
unset test_url test_key prod_url prod_key host

# Both test scripts build into .next-test (next.config.ts reads NEXT_DIST_DIR), so test values
# never land in .next, which the regular build, the check script, and Vercel use.
export NEXT_DIST_DIR=.next-test

# A build or dev server in .next-test makes Next add .next-test paths to tsconfig.json and point
# next-env.d.ts at .next-test. Save both now; restore_ts_files puts them back (also on exit).
ts_backup=$(mktemp -d)
cp tsconfig.json "$ts_backup/"
[ -f next-env.d.ts ] && cp next-env.d.ts "$ts_backup/"
restore_ts_files() {
  [ -d "$ts_backup" ] || return 0
  cp "$ts_backup/tsconfig.json" tsconfig.json
  if [ -f "$ts_backup/next-env.d.ts" ]; then cp "$ts_backup/next-env.d.ts" next-env.d.ts; else rm -f next-env.d.ts; fi
  rm -rf "$ts_backup"
}
trap restore_ts_files EXIT
# npm may stop the script with a signal rather than let it exit; restore in that case too.
trap 'restore_ts_files; exit 130' INT
trap 'restore_ts_files; exit 143' TERM
trap 'restore_ts_files; exit 129' HUP
