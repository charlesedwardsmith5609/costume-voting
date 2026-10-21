# Costume contest voting

Mobile web app for a Halloween house party: guests scan a QR code, nominate costumes with a photo, and vote in four categories. Votes stay private to the host until results are published. Stack: Next.js (App Router) on Vercel, Supabase (Postgres + Storage), Tailwind CSS.

Requires **Node.js 22+** (`package.json` engines).

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

1. Import this GitHub repo into a Vercel project.
2. Set the production environment variables listed above.
3. Ensure the four sound files are present in `public/sounds/` for the deploy (they are not in git).
4. Deploy. Point a short domain at the project when you have one.

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
