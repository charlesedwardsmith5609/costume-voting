#!/usr/bin/env bash
# Production build and server against the TEST Supabase project, for manual testing on phones.
# Usage: npm run start:test [-- next start args, e.g. -p 3001]
# next build writes NEXT_PUBLIC_* values into the build, so this builds with the test values
# into .next-test and serves from there. The regular build, the check script, and Vercel use
# .next with production values and never see this one. The env mapping, the production guard,
# and the .next-test folder are in test-env.sh.
set -euo pipefail
cd "$(dirname "$0")/.."
. scripts/test-env.sh start:test
npx --no-install next build
restore_ts_files
exec npx --no-install next start "$@"
