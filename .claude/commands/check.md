---
description: Run the validation gate (typecheck, test, build, client bundle secrets) and report per stage
---
Run the validation gate: `bash scripts/check.sh` (WSL/bash only).

Report PASS or FAIL for each stage (typecheck, test, build, client bundle secrets).
If anything fails, diagnose the cause and propose the smallest fix, but do not apply it until the
human approves.
