# Pairing mode: working agreements

A human engineer directs this work and owns every design decision: what to build, what to
accept, what to reject, and how to verify it. You implement scoped asks and keep your reasoning
visible so each decision can be reviewed before it lands.

The product is specified in `SPEC.md`. Stack: Next.js (App Router, TypeScript) on Vercel,
Supabase (Postgres + Storage), Tailwind CSS, Vitest.

## Rules

1. **Plan before code.** For any new ask, reply first with a short plan: files touched, types,
   where each piece of state lives, and the tests you will add. Wait for approval before writing
   code. Exception: when the human says "scaffold", write boilerplate directly.
2. **Small diffs, one concern each.** Do not add features that were not asked for. If you think
   something is missing (validation, limits, a screen), list it under "Suggestions" at the end of
   your reply instead of implementing it.
3. **Approved dependencies only.** Approved: `next`, `react` (+ `react-dom`),
   `@supabase/supabase-js`, `tailwindcss` (+ `@tailwindcss/postcss`), `browser-image-compression`,
   `qrcode`, `vitest`, plus `typescript` and `@types/*`. Anything else needs approval: name it and
   say what it replaces and why.
4. **Done means the check passes.** After every change, run the check command below and report the
   result per stage (typecheck, test, build, client bundle secrets). A clean compile is not done.
5. **Behavioral tests.** Test server rules (voting window, vote changes, rate limits, admin auth,
   merge) by calling the real route handlers against the test Supabase project
   (`TEST_SUPABASE_*`), never production. Every test that waits on I/O has a timeout. No sleeps
   for synchronization; drive time through the database settings row instead.
6. **Name where state lives.** Postgres owns all shared state. Serverless functions keep no
   in-memory state between requests (no in-memory rate limits or caches). Multi-step writes
   (vote, nominate, merge, reset) run as a single Postgres function so they are atomic and use the
   database clock. For any change that touches shared state, say which table or function owns it.
7. **Load the skill first.** Read `skills/next-supabase-service.md` before writing server code.
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
