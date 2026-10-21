#!/usr/bin/env bash
# Local dev server against the TEST Supabase project, for manual testing on phones.
# Usage: npm run dev:test [-- next dev args, e.g. -p 3001]
# The env mapping, the production guard, and the .next-test build folder are in test-env.sh.
# Not exec'd, so tsconfig.json and next-env.d.ts are restored when the server stops.
set -euo pipefail
cd "$(dirname "$0")/.."
. scripts/test-env.sh dev:test
npx --no-install next dev "$@"
