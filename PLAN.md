# Build plan

Party: Saturday, October 24, 2026. Ready and tested on real phones by Friday, October 23.
Product spec: `SPEC.md`. Updated at the end of each milestone.

## Milestones

| # | Scope | Target | Status |
|---|---|---|---|
| M0 | Toolchain, scaffold, check scripts, rules update | Sat 10/17 | Done (`3604d08`) |
| M1 | SQL migration plus tests of the SQL functions; host creates Supabase projects and env vars | Sun 10/18 | Done (`b2e50f2`, `d1a9588`) |
| M2 | Guest API routes plus tests: time window, vote changes, hidden or wrong-category nominee, rate limits, no vote data in responses | Mon 10/19 | Done (`81c7c4a`) |
| M3 | Admin auth and routes plus tests: every route returns 401 without the cookie; merge and reset; start by close time | Mon 10/19 | Done (`bd543ec`) |
| M4 | Guest UI: home (open-until time, last-15-minute countdown and banner), category grid, add nominee with compression and retry, dark theme at 360 px | Tue 10/20 | In review: code and tests written, check passes |
| M5 | Admin UI (close-time picker as the default, preset to 10:00 PM on Sat 10/24), reveal view (ties, zero votes), QR page and PNG | Wed 10/21 | Not started |
| M6 | README, party-night runbook, Vercel deploy; host provides Vercel account, env vars, and domain | Thu 10/22 | Not started |
| — | Host testing on real phones (one iPhone with Safari, one Android with Chrome) | Fri 10/23 | — |

## Current status

M2 is done: all eight guest routes (`state`, `nominees`, `my-votes`, `vote`, `upload-url`,
`nominate`, `add-to-category`, `edit`), `lib/nomineeLabel.ts`, device ID handling, and route tests
against the test project, including a check that no guest response contains vote data or any
device ID. Cross-review findings are fixed. Migrations 0002 and 0003 are on the test project.

M3 is done: login, logout, and session; timer (duration or close time); results; moderation
(nominee list, hide, delete, host edit and upload URL, set category, merge, edit history, undo);
CSV export; and reset. A test finds every admin route on disk and checks it returns 401 without a
valid session. Cross-review findings (1,000-row read limits) accepted: the party has at most
100 guests. No migration needed.

M4 is in review: home, category, add, and edit screens, with photo thumbnails. Pure logic
(clock and countdown, search, photo checks, the upload and retry steps, error copy) has unit
tests; layout, camera, and EXIF need the phone checks. Scope addition: "Nominate a costume"
on the home screen (`/nominate`, `/nominate/[id]`, `/nominate/new`), the unfiltered nominee list,
and migration 0004 (`add_nominee_to_categories`).

Manual testing: `npm run dev:test` runs the dev server against the test project (see
`scripts/dev-test.sh`); don't run the check at the same time, since it resets that project.

Before deploy (M6): run `0002_guest_reads.sql`, `0003_photo_uploads.sql`, and
`0004_add_categories.sql` on production.

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
| M3 | **Admin session:** a signed cookie (expiry plus HMAC with `SESSION_SECRET`), HttpOnly, SameSite=Strict, 12 hours; no server-side session store. Login is limited to 10 attempts per IP per 10 minutes through `rate_limits`. |
| M3 | **CSV and delete:** hidden nominees' rows show their actual votes; guest text starting with `=`, `+`, `-`, or `@` gets a leading `'`; deleting a nominee keeps its photos in Storage until Reset. |
| M4 | **Thumbnails:** each photo gets a 600 px `<path>.thumb.jpg` made on the phone and uploaded through a second signed URL; guest grids and strips use it and fall back to the full photo. No schema change. Photos are compressed on the page, not in the library's web worker, which loads from a CDN. |
| M4 | **Guest screens:** before start and after close, the grid stays visible with Vote, Add, and Edit hidden. The phone polls `/api/state` every 15 seconds and corrects its clock by the measured offset for the countdown. |
| M4 | **Upload retries (cross-review):** a failed photo upload starts over with fresh URLs (Storage may have kept the file, or the URL expired). After a save with no clear answer, an "already used" photo on retry counts as saved, so a lost response never creates a duplicate nominee. No idempotency key or migration needed, since only the issuing device can use a path. |
| M4 | **Nominate a costume (scope addition):** a home-screen flow: pick an existing nominee to add categories, or add someone new with nothing pre-checked and no "Already nominated?" strips. Both return home; the button is hidden outside the voting window. `GET /api/nominees` without `category` lists every non-hidden nominee, newest created first. Adding several categories is one call to `add_nominee_to_categories` (migration 0004): one rate-limit hit, one edit-history row, all or nothing. `/api/add-to-category` now takes `categories: [...]`. |
