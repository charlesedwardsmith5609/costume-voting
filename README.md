# Costume contest voting

Mobile web app for a Halloween house party: guests scan a QR code, nominate costumes with a photo, and vote in four categories. Votes stay private to the host until results are published. Stack: Next.js (App Router) on Vercel, Supabase (Postgres + Storage), Tailwind CSS.

Requires **Node.js 22+** (`package.json` engines).

## Overview

**Guests** scan a QR code, nominate costumes with a photo (compressed on the phone), and vote in
four categories (Most Elaborate, Most Unique, Funniest, Best Couples Costume). Voting is anonymous:
one vote per device per category, changeable until the host closes voting. Guests never see counts.

**The host** (`/admin`, password protected) starts and ends voting, sees live results, hides,
edits, merges, or deletes nominees (with an edit history and undo), publishes the winners, and runs
a full-screen winner reveal for a TV: tap-to-reveal cards, drumroll, fireworks, applause, a
"Congratulations" page, and a random photo slideshow of the evening. The reveal can be run from the
host's phone (`/admin/remote`). There is also a printable QR page and a CSV export.

### How it is built

- **Next.js App Router + TypeScript**, Tailwind v4, deployed on Vercel. Dependencies are kept
  minimal (`@supabase/supabase-js`, `browser-image-compression`, `qrcode`; tests use Vitest).
- **Postgres owns all shared state** (Supabase). Every multi-step write (vote, nominate, edit, merge,
  reset, timer) is a single SQL function using the database clock, so nothing relies on
  in-memory state in serverless functions. Rate limits are a table.
- **The browser never talks to the database.** Row Level Security is on with no policies for the
  anon key; every write goes through a route handler using the service role key. Admin routes check
  a signed, HttpOnly session cookie on every request. Tests prove the anon key cannot call any
  function or read any table, and that every admin route returns 401 without the cookie.
- **Photos** upload straight to a public Storage bucket through server-issued signed URLs with
  unguessable paths; a thumbnail is uploaded next to each photo.
- **The phone remote** works through one shared database row: the phone sends commands, the TV page
  polls for them and publishes its status. No websockets.
- **Sound** is played with the Web Audio API from four files in `public/sounds/` (not in git).

### Where things are

| Path | What |
|---|---|
| `app/` | Pages and API routes (`app/api` guest routes, `app/api/admin` host routes) |
| `components/`, `components/admin/` | Guest and host UI |
| `lib/` | Shared client code; `lib/server/` is server-only (service role key lives here) |
| `supabase/migrations/` | The schema and SQL functions, run in order (source of truth) |
| `tests/` | Unit tests, route tests, and database tests against a separate test project |
| `scripts/` | `check.sh` (the validation gate), `dev-test.sh`, `cross-review.sh` |
| `SPEC.md`, `PLAN.md` | The product spec, and the milestone plan with every design decision |
| `CLAUDE.md`, `AGENTS.md` | The working agreements used to build this with AI pair programmers |

### Credits and licenses

Music and sound effects come from Pixabay (Pixabay Content License) and BigSoundBank (CC0); see
`public/sounds/CREDITS.md`. The files are licensed for use, not redistribution, so they are not in
this repository. Without them the reveal still works (the drumroll falls back to synthesized
sound; the music, fireworks, and applause are skipped). No license has been chosen for this code.

## Setup

### Supabase

1. Create two Supabase projects: one for production, one for tests only.
2. In each project's SQL editor, run the migrations in `supabase/migrations/` **in order**:
   - `0001_init.sql` (creates tables, functions, RLS, and the public `nominee-photos` Storage bucket)
   - `0002_guest_reads.sql`
   - `0003_photo_uploads.sql`
   - `0004_add_categories.sql`
   - `0005_publish_results.sql`
   - `0006_slideshow_exclusions.sql`
   - `0007_reveal_remote.sql`
3. On the **test** project only, also run `supabase/test_marker.sql` once. Never run it on production. The test suite refuses to wipe a database that lacks this marker.

### Environment variables

Copy `.env.example` to `.env.local` and fill in real values. Never commit `.env.local`.

| Variable | Where |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Production project URL |
| `SUPABASE_SERVICE_ROLE_KEY` | Production project's secret key (`sb_secret_...`). Server only; never use a `NEXT_PUBLIC_` prefix |
| `ADMIN_PASSWORD` | Host login password for `/admin` |
| `SESSION_SECRET` | Random string, 32+ characters (e.g. `openssl rand -base64 32`) |
| `TEST_SUPABASE_URL` | Test project URL (tests and `npm run dev:test` only) |
| `TEST_SUPABASE_SERVICE_ROLE_KEY` | Test project's secret key (`sb_secret_...`) |
| `TEST_SUPABASE_ANON_KEY` | Test project's publishable key (`sb_publishable_...`); used only to prove anon cannot access tables or functions |

On Vercel, set the production variables only (not the `TEST_SUPABASE_*` ones).

### Sound files

The reveal uses four MP3s that are **gitignored** (licensed for use, not redistribution):

- `public/sounds/music.mp3`
- `public/sounds/drumroll.mp3`
- `public/sounds/fireworks.mp3`
- `public/sounds/applause.mp3`

Copy them into `public/sounds/` by hand for local runs and for each deploy. Sources and licenses: `public/sounds/CREDITS.md`.

### Vercel deploy

Deploy from this folder with the Vercel CLI, not by importing the GitHub repo. The sound files in
`public/sounds/` are gitignored (license), so a deploy built from git would have no music or
effects. `.vercelignore` makes the CLI upload them from your machine.

1. Make sure `public/sounds/` has the four `.mp3` files (see above).
2. `npx vercel link` once, to create or pick the Vercel project.
3. In the Vercel project settings, set the production environment variables listed above.
4. `npx vercel --prod` from the repo root. Run `bash scripts/check.sh` first.
5. Point a short domain at the project when you have one.

## Commands

| Command | Purpose |
|---|---|
| `npm run dev` | Local Next.js server using `.env.local` (production Supabase project) |
| `npm run dev:test` | Local server against the **test** Supabase project (`scripts/dev-test.sh`) |
| `bash scripts/check.sh` | Typecheck, tests (against the test project), production build, client-bundle secret scan |

**Do not run `bash scripts/check.sh` while `npm run dev:test` is running.** The check resets the test project.

## Party-night runbook

### Login

Open `/admin` on the production site and sign in with `ADMIN_PASSWORD`. The session lasts 12 hours.

### Voting window (`/admin`)

- **Start voting:** choose a closing time (default) or a duration, then **Start voting**.
- **Extend:** while open, **+ 5 minutes** or **+ 10 minutes**.
- **End now:** **End voting now** (guests can no longer vote, nominate, or edit).
- **Reopen:** after close, use **Reopen voting** (same start form). Reopening unpublishes guest results if they were published.
- **Publish results:** after voting is closed, **Publish results** so guests see winners and rankings (never vote counts). Until then they see “Votes are in! Stand by for the winners to be announced.” Use **Unpublish results** to hide them again.

### QR code

Open `/admin/qr` on the **production** domain before printing or downloading the PNG. The page encodes this site’s address; on localhost the URL is shown in red because guests cannot reach it.

### Live results

`/admin/results` — tallies per category with photos, for the host only.

### Moderation

`/admin/nominees` — list every nominee (including hidden). Hide or delete from the list; open a nominee for names, photo, categories, merge, and edit history with undo.

### Winner reveal and slideshow

1. On the **TV**, open `/admin/reveal` and tap **Tap to start** once (browsers block sound until a tap).
2. On your **phone**, log in at `/admin` and open `/admin/remote` to drive the reveal from your hand (reveal, next/previous, mute). The remote needs the TV page connected after that first tap.
3. After the last category, the winners page shows **Congratulations to our winners!** Start the slideshow with **Start slideshow**, or wait — it starts by itself after **5 minutes**.
4. Before or during the party, use `/admin/slideshow` to remove (or restore) photos from the final slideshow. Changes apply the next time the slideshow starts.

Tools also links to the reveal, phone remote, and slideshow management.

### CSV export

On `/admin/tools`, **Download CSV** — one row per nominee per category with ranks and vote counts.

### Reset

On `/admin/tools`, **Reset everything** clears votes, nominees, edit history, photos, the timer, and slideshow removals. You must type `RESET` to confirm.

**Reset is for testing before the party only. Never run Reset while guests are nominating or voting.**
