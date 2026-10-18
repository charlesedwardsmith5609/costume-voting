# Build plan

Party: Saturday, October 24, 2026. Ready and tested on real phones by Friday, October 23.
Product spec: `SPEC.md`. Updated at the end of each milestone.

## Milestones

| # | Scope | Target | Status |
|---|---|---|---|
| M0 | Toolchain, scaffold, check scripts, rules update | Sat 10/17 | Done (`3604d08`) |
| M1 | SQL migration plus tests of the SQL functions; host creates Supabase projects and env vars | Sun 10/18 | Done (`b2e50f2`, `d1a9588`) |
| M2 | Guest API routes plus tests: time window, vote changes, hidden or wrong-category nominee, rate limits, no vote data in responses | Mon 10/19 | Done (branch `feat/m2-guest-api`) |
| M3 | Admin auth and routes plus tests: every route returns 401 without the cookie; merge and reset; start by close time | Mon 10/19 | Not started |
| M4 | Guest UI: home (open-until time, last-15-minute countdown and banner), category grid, add nominee with compression and retry, dark theme at 360 px | Tue 10/20 | Not started |
| M5 | Admin UI (close-time picker as the default, preset to 10:00 PM on Sat 10/24), reveal view (ties, zero votes), QR page and PNG | Wed 10/21 | Not started |
| M6 | README, party-night runbook, Vercel deploy; host provides Vercel account, env vars, and domain | Thu 10/22 | Not started |
| — | Host testing on real phones (one iPhone with Safari, one Android with Chrome) | Fri 10/23 | — |

## Current status

M2 is done: all eight guest routes (`state`, `nominees`, `my-votes`, `vote`, `upload-url`,
`nominate`, `add-to-category`, `edit`), `lib/nomineeLabel.ts`, device ID handling, and route tests
against the test project, including a check that no guest response contains vote data or any
device ID. Cross-review findings are fixed. Migrations 0002 and 0003 are on the test project.

Next: M3 (admin auth and routes, including start by close time).

Before deploy (M6): run `0002_guest_reads.sql` and `0003_photo_uploads.sql` on production.

## Decisions

| When | Decision |
|---|---|
| M0 plan | **Stack:** Next.js App Router (TypeScript) on Vercel, Supabase Postgres and Storage, Tailwind, Vitest. Every write goes through server routes with the service role key; the anon key has no table or function access. Tests run against a second Supabase project. |
| M0 plan | **Shared state in Postgres:** rate limits are a `rate_limits` table, and every multi-step write is one Postgres function using the database clock. Photos upload directly to Storage through server-issued signed URLs (Vercel's 4.5 MB body limit). |
| M0 plan | **Multi-category nominees:** one `nominees` row per costume, linked to categories through `nominee_categories`. A vote must reference a (nominee, category) pair that exists; removing a category deletes only that category's votes. |
| M0 plan | **Optional names:** person and costume names are each optional (max 60 characters, trimmed, blank stored as null). Photo-only nominees show as "Mystery guest 👻". |
| M0 plan | **Edit and undo:** anyone can edit names and photo and add categories while voting is open; only the host removes categories or edits after close. Every edit is logged with old and new values; replaced photos are never deleted. Undo restores only the fields that edit changed, is logged as a host edit, and can itself be undone. |
| M0 plan | **Rank ties:** dense ranking by vote count (1, 1, 2). The reveal view shows all tied nominees. |
| M0 plan | **CSV format:** one row per nominee per category: category, rank, display label, person_name, costume_name, votes, hidden, photo URL. Hidden nominees are listed last with an empty rank. |
| M2 | **All-night voting window:** one window for nominating, editing, uploads, and voting, from start until close; no separate nominations phase. Guests can change their vote until close. Phases stay `not_started`, `open`, `closed`. The host starts with a close time (default, preset to 10:00 PM on Sat 10/24, host's local time) or a duration. Guests see "Voting open until [time]", and in the last 15 minutes a live countdown with a "Voting closes soon!" banner. |
| M2 | **Guest API details (M2):** upload URLs are limited to 20 per device per 10 minutes and only issued while voting is open. Category lists are newest first by time added to that category. `/api/my-votes` leaves out votes for hidden nominees. |
| M2 | **No device IDs in photo paths (cross-review):** guest photos are `guest/<uuid>.jpg`, with the owning device in `photo_uploads`, because a device ID read from a public photo URL was enough to read or change that device's votes. Upload URLs issued just before close stay valid for 2 hours; accepted, since a late upload can never become a nominee or an edit. |
