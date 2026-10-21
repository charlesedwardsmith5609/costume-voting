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
| M5 | Admin UI (close-time picker as the default, preset to 10:00 PM on Sat 10/24), reveal view (ties, zero votes), QR page and PNG | Wed 10/21 | In review: code and tests written, check passes |
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

M5 is in review: admin timer (with publish), live results, nominee list and detail (names, photo,
categories, edit history with undo, merge), Tools (CSV export, guarded reset), QR page (print and
PNG), and a full-screen winner reveal at `/admin/reveal` (tap to reveal, animated scenery, music,
drumroll, fireworks, applause). Reset and merge are not undoable. Phone remote for the reveal (`/admin/remote`, migration 0007; Reset also unpublishes now). Server side of the final
slideshow is done: migration 0006, `GET /api/admin/photos`, `POST /api/admin/slideshow-exclude`.

Manual testing: `npm run dev:test` runs the dev server against the test project (see
`scripts/dev-test.sh`); don't run the check at the same time, since it resets that project.

Before deploy (M6): run `0001` through `0007` (`0001_init`, `0002_guest_reads`, `0003_photo_uploads`,
`0004_add_categories`, `0005_publish_results`, `0006_slideshow_exclusions`, `0007_reveal_remote`) on
production, in order (production has none of them yet). All of them are already on the test project. The sound files in `public/sounds/` are gitignored (license: not
for redistribution), so they must be copied into the deploy by hand; see `public/sounds/CREDITS.md`.

## Remaining tasks

Tags: **[CURSOR]** UI, copy, styling, small bug fixes. **[CLAUDE]** RLS, SQL functions, admin auth,
security, migrations, final pre-deploy review. Do them in this order, one per session. Each ends
with `bash scripts/check.sh` passing (never while `dev:test` is running) and a short report.

1. **[CURSOR] Slideshow management page.** Goal: the host removes photos from the final slideshow.
   Files: `app/admin/slideshow/page.tsx`, `components/admin/SlideshowPhotoCard.tsx`,
   `lib/adminApi.ts` (`fetchSlideshowPhotos`, `setSlideshowExcluded`, error copy), a "Slideshow"
   link in `components/admin/AdminNav.tsx` or the Tools page.
   Accept: a grid of every photo from `GET /api/admin/photos` with its label and a source badge
   (Current, Hidden, Earlier photo, Unused); Remove / Restore per photo calls
   `POST /api/admin/slideshow-exclude`, asks nothing, and shows removed photos dimmed; a filter by
   source; mystery and unused photos have a label like "No name"; 401 calls `useAdmin().expired()`.
   Tap targets 44 px; works at 360 px.
2. **[CURSOR] Final winners page.** Goal: after the last category, a page showing all winners.
   Files: `app/admin/reveal/page.tsx`, new `components/admin/RevealWinners.tsx`, `lib/reveal.ts`.
   Accept: one more step after the last category with "Congratulations to our winners!", every
   category's winner(s) with photo and name (ties together; "No votes" categories noted), the
   celebration and applause, a "Start slideshow" button, and an automatic start 5 minutes after the
   page appears. Music returns during it. Reduced motion respected. Unit test for any new pure helper.
3. **[CURSOR] Slideshow.** Goal: a looping random slideshow to reflect on the evening.
   Files: new `components/admin/RevealSlideshow.tsx`, `lib/reveal.ts` (shuffle helper, unit test),
   `app/admin/reveal/page.tsx`.
   Accept: loads `GET /api/admin/photos`, drops excluded photos, shows each photo full screen with
   a slow zoom and fade and the label (none for unused), in a random order that reshuffles after
   all are shown, skips a photo that fails to load, keeps the music playing, and runs until
   the host presses Exit or Escape. Handles an empty list with a message.
4. **[CURSOR] SPEC.md update.** Goal: SPEC matches the built app.
   Files: `SPEC.md`. Accept: privacy and leaderboard wording; slideshow (exclusions, sources, 5
   minute auto start); reveal sound; new acceptance tests for publishing, reveal, slideshow, QR,
   and tools; admin routes and `slideshow_exclusions` in the data section.
5. **[CLAUDE] M5 cross-review.** Goal: `bash scripts/cross-review.sh` on the branch, assess each
   finding, change nothing until the host decides. Security focus: the new admin routes, 0006, and
   public photo URLs for hidden or unused photos (they are public in Storage by design).
6. **[CLAUDE] Done:** Reset also clears `results_published_at` (in `0007_reveal_remote.sql`).
7. **[CURSOR] M6 docs.** Goal: README and the party-night runbook. Files: `README.md`.
   Accept: setup (env vars, Supabase projects, migrations 0001 to 0006), sound files (not in git),
   how to start, extend, end, and publish, how to run the reveal and slideshow (including the phone remote at `/admin/remote`: log in on the phone, open the reveal on the TV and tap "Tap to start" there once for sound), and the warning
   "never run Reset while guests are nominating or voting".
8. **[CLAUDE] M6 deploy review.** Goal: final pre-deploy review of env vars, RLS, bundle secrets,
   and production migrations. The host runs the SQL and the Vercel setup.
9. Host testing on real phones (iPhone Safari, Android Chrome) and a TV rehearsal of the reveal.

Open review items: the phone remote (0007, routes) has not been cross-reviewed. No M4 cross-review findings are recorded as open in this file (M2 to M4
findings are all listed above as fixed or accepted). M5 has not been cross-reviewed yet (task 5).

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
