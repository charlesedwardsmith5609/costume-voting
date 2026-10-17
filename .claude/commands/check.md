---
description: Run the validation gate (gofmt, vet, test -race) and report per stage
---
Run the validation gate: `pwsh -NoProfile -File scripts/check.ps1` on Windows, otherwise
`bash scripts/check.sh`.

Report PASS or FAIL for each stage (gofmt, go vet, go test) and whether the race detector ran.
If anything fails, diagnose the cause and propose the smallest fix, but do not apply it until the
human approves.
