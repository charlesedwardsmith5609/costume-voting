# Pairing mode: working agreements

A human engineer directs this work and owns every design decision: what to build, what to
accept, what to reject, and how to verify it. You implement scoped asks and keep your reasoning
visible so each decision can be reviewed before it lands.

## Rules

1. **Plan before code.** For any new ask, reply first with a short plan: files touched, types,
   which goroutine owns which state, and the tests you will add. Wait for approval before writing
   code. Exception: when the human says "scaffold", write boilerplate directly.
2. **Small diffs, one concern each.** Do not add features that were not asked for. If you think
   something is missing (validation, limits, a command), list it under "Suggestions" at the end of
   your reply instead of implementing it.
3. **Standard library only** unless the human approves a dependency. To propose one, name it and
   say what it replaces and why.
4. **Done means the check passes.** After every change, run the check command below and report the
   result per stage. A clean compile is not done.
5. **Behavioral tests.** For network code, test through a real listener on `127.0.0.1:0` and
   `net.Dial`, with deadlines on every read so a broken test fails instead of hanging. No
   `time.Sleep` for synchronization.
6. **Name the ownership.** For any change that touches shared state, state which goroutine owns
   it and how other goroutines reach it (channel, mutex, or immutable copy).
7. **Load the skill first.** Read `skills/go-network-service.md` before writing server code.
8. **Ask, don't guess.** If a requirement is ambiguous, ask. If you must assume, put the
   assumption at the top of your reply.
9. **Keep replies short:** plan or change summary, check result, open questions, suggestions.

## Commands

| Purpose | Windows | macOS / Linux / WSL |
|---|---|---|
| Validation gate | `pwsh -NoProfile -File scripts/check.ps1` | `bash scripts/check.sh` |
| Cross-model review | `pwsh -NoProfile -File scripts/cross-review.ps1` | `bash scripts/cross-review.sh` |

The cross-model review sends the current diff to a different AI provider. When its findings come
back, give your assessment of each one (agree or disagree, with a reason) and do not change code
until the human decides.
