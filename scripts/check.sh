#!/usr/bin/env bash
# Validation gate: gofmt, go vet, go test with the race detector.
# Usage: bash scripts/check.sh
set -u
cd "$(dirname "$0")/.." || exit 2

fail=0
if [ -z "$(go list ./... 2>/dev/null)" ]; then
  echo "No Go packages yet. Toolchain OK: $(go version)"
  echo "CHECK PASSED (nothing to check)"
  exit 0
fi
stage() { printf '\n== %s\n' "$1"; }

stage "gofmt"
unformatted=$(gofmt -l . 2>&1)
if [ -n "$unformatted" ]; then
  echo "FAIL: files need gofmt:"; echo "$unformatted"; echo "Fix: gofmt -w .  (on Windows this is often CRLF line endings)"; fail=1
else
  echo "PASS"
fi

stage "go vet"
if go vet ./...; then echo "PASS"; else echo "FAIL"; fail=1; fi

stage "go test"
race_flag="-race"
if [ "$(go env CGO_ENABLED)" != "1" ] || ! command -v "$(go env CC)" >/dev/null 2>&1; then
  echo "WARNING: race detector unavailable (needs CGO_ENABLED=1 and a C compiler)."
  echo "WARNING: running tests WITHOUT -race."
  race_flag=""
fi
# shellcheck disable=SC2086
if go test $race_flag -count=1 -timeout 60s ./...; then echo "PASS"; else echo "FAIL"; fail=1; fi

echo
if [ "$fail" -eq 0 ]; then
  echo "CHECK PASSED${race_flag:+ (with -race)}"
else
  echo "CHECK FAILED"
fi
exit "$fail"
