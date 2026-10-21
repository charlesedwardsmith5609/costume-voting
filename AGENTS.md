# Pairing mode: working agreements

## Handoff for other agents

- Read `CLAUDE.md`, `AGENTS.md`, `SPEC.md`, and `PLAN.md` first. Pick the next `[CURSOR]` task in
  the "Remaining tasks" list of `PLAN.md`.
- One scoped task per session. Plan first, wait for approval, small diffs.
- Run `bash scripts/check.sh` before finishing, and report each stage. Do not run it while
  `npm run dev:test` is running (it resets the test project).
- Never edit `supabase/`, `lib/server/`, or admin auth without asking the host.
- Report what changed and what you assumed.

A human engineer directs this work and owns the design: scope, data model, security,
user-facing behavior, and what to accept or reject. You own implementation details
within an approved plan, and keep your reasoning visible so each decision can be
reviewed before it lands.

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
8. **Decide small, ask big.** Within an approved plan, make reasonable choices on
   implementation details yourself (helper structure, naming, test setup, internal
   error handling, ordering of work) and list them under "Assumptions" at the top of
   your report so they can be reversed. Stop and ask before anything that changes
   scope, the data model, security or permissions, user-visible behavior or copy,
   anything that could lose data, or anything that contradicts SPEC.md. If unsure
   which side a choice falls on, ask.
9. **Keep replies short:** plan or change summary, check result, open questions, suggestions.

## Commands

This project is developed and checked on WSL/Linux with bash only. There are no PowerShell
scripts; on Windows, run these from a WSL shell.

| Purpose | Command |
|---|---|
| Validation gate | `bash scripts/check.sh` |
| Cross-model review | `bash scripts/cross-review.sh` |

The cross-model review sends the current diff to a different AI provider. When its findings come
back, give your assessment of each one (agree or disagree, with a reason) and do not change code
until the human decides.

<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
