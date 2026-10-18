# Costume Contest Voting App: Build Spec

## Goal

A mobile web app for a Halloween house party (Saturday, October 24, 2026, roughly 30 to 60 guests). Guests scan a QR code, nominate costumes with a photo, and vote in four categories. Votes are private to the host, tallied automatically, and locked when a countdown ends.

It must be ready and tested on real phones by Friday, October 23.

## Hard requirements

1. **No sign-in for guests.** No accounts, no email, no app install. Scan and go.
2. **Mobile first.** Designed for phones in one hand, in a dim room, on spotty Wi-Fi.
3. **Votes are private.** Guests never see vote counts, rankings, or who voted for whom. Only the host sees results.
4. **Automatic tallying** per category, live on the admin page.
5. **Countdown timer.** The host starts it with a chosen duration. When it hits zero, voting and nominating lock, enforced on the server, not just in the UI.
6. **Fast nomination.** Adding a nominee takes under 30 seconds: take or pick a photo, type a name, choose a category, submit.

## Categories

Fixed list, in this order:

1. Most Elaborate
2. Most Unique
3. Funniest
4. Best Couples Costume

## Suggested stack

- **Next.js** (App Router, TypeScript) deployed on **Vercel** free tier
- **Supabase** free tier: Postgres for data, Storage for photos
- **Tailwind CSS** for styling
- **browser-image-compression** (or equivalent) for client-side photo resizing
- **qrcode** npm package to generate the QR code

All database writes go through Next.js server routes (or server actions) using the Supabase service role key, which never reaches the browser. The anon key gets no direct table access. Photos live in a public-read Storage bucket with unguessable file names; uploads also go through the server (signed upload URLs are fine).

## Guest experience

### Home screen

- Party title and a short line: "Vote for your favorite costumes!"
- Countdown display when the timer is running ("Voting closes in 12:34"), or a "Voting opens soon" state before the host starts it, or "Voting is closed" after.
- Four category tabs or cards. Show a checkmark on categories where this device has already voted.

### Category screen

- Grid of nominee cards: photo (square crop, large), nominee name.
- Tap a card to select it, then a clear "Vote" button. Tapping a different nominee and voting again **changes** this device's vote (one vote per device per category, last vote wins until voting closes).
- Show "Your vote: [name]" at the top once voted.
- Prominent "+ Add a nominee" button.
- Light search or filter by name once a category has more than about 8 nominees.
- Nominees sorted alphabetically or by time added. Never sorted by votes.

### Add a nominee

- Photo: one button that opens the camera on phones, with the option to choose from the library (`<input type="file" accept="image/*" capture="environment">` plus a second plain file input, or equivalent).
- Name field (required, max 60 characters), with placeholder like "Who is it? (e.g., Sam as the Mad Hatter)".
- Category picker, preselected to the current category.
- Before submit, show the guest existing nominees in that category with similar names ("Already nominated?") to reduce duplicates.
- Compress the photo on the device before upload: max 1600 px on the long side, JPEG around 0.8 quality, target under 500 KB. Strip EXIF location data. Correct EXIF orientation.
- Show upload progress and a friendly retry on failure, keeping the entered name and photo.
- After success, return to the category screen with the new nominee visible. Do not auto-vote.

### Device identity

- On first visit, generate a random device ID (UUID) and keep it in localStorage, with a cookie fallback.
- One vote per device per category, enforced by a unique constraint in the database.
- This is intentionally not tamper-proof. It's a friendly party contest; don't add sign-in to harden it.

## Host (admin) experience

- Route: `/admin`, protected by a password from an environment variable (`ADMIN_PASSWORD`). Use an httpOnly session cookie after login. Every admin API route checks it on the server.
- **Timer controls:** start with a duration picker (default 30 minutes), extend by 5 or 10 minutes, end now, and reopen.
- **Live results:** per category, nominees ranked by vote count with photo thumbnails, auto-refreshing every few seconds (or Supabase Realtime). Show total votes per category and number of distinct voting devices.
- **Winner reveal view:** a full-screen view showing the winner of each category with their photo, one at a time, for announcing on a TV or the host's phone. Handle ties by showing all tied nominees.
- **Nominee moderation:** hide or delete a nominee, rename, change category, and merge duplicates (moving votes to the kept nominee; if a device voted for both, keep one vote).
- **QR code page:** shows a large, printable QR code for the guest URL with the text "Scan to vote for best costume!" and the categories listed.
- **Reset:** a guarded "clear all votes and nominees" action for testing, requiring the host to type RESET.

## Data model

```sql
create table settings (
  id int primary key default 1 check (id = 1),
  voting_opens_at timestamptz,
  voting_closes_at timestamptz
);

create table nominees (
  id uuid primary key default gen_random_uuid(),
  category text not null check (category in
    ('most_elaborate','most_unique','funniest','best_couples')),
  name text not null check (char_length(name) between 1 and 60),
  photo_path text not null,
  created_by_device uuid not null,
  hidden boolean not null default false,
  created_at timestamptz not null default now()
);

create table votes (
  device_id uuid not null,
  category text not null,
  nominee_id uuid not null references nominees(id) on delete cascade,
  updated_at timestamptz not null default now(),
  primary key (device_id, category)
);
```

- Enable Row Level Security on all tables with **no policies for the anon role**, so the browser cannot read or write tables directly. All access goes through server routes using the service role.
- Voting is an upsert on `(device_id, category)`. The server checks that the nominee exists, isn't hidden, belongs to that category, and that `now()` is between `voting_opens_at` and `voting_closes_at`.
- Nominating checks the same time window.
- Public API returns only nominee id, name, category, and photo URL, never vote data. The only vote data a guest can get is their own device's current pick per category.

## Abuse and safety (keep it light)

- Rate limit per device: at most 10 nominations and 60 vote requests per 10 minutes.
- Reject uploads that aren't images or are over 5 MB after compression.
- Host can hide any nominee instantly.
- No personal data collected beyond what guests type as a nominee name.

## Non-goals

- No user accounts, social login, comments, or sharing.
- No public leaderboard.
- No native app.

## Acceptance tests

Write automated tests where practical (server route tests for voting and timer rules) and run the rest manually on real phones (at least one iPhone with Safari and one Android with Chrome).

1. A new guest scans the QR code and reaches the home screen in under 3 seconds on a phone.
2. A guest can add a nominee using the phone camera, and it appears in the right category for a second phone within 5 seconds of refreshing.
3. A 12 MB phone photo uploads successfully after compression, oriented correctly, with no GPS data in the stored file. Manual check: take a real photo with location enabled on each test phone, upload it, download the stored file from the bucket, and confirm with an EXIF viewer (e.g., `exiftool`) that it has no GPS tags and displays upright.
4. A device votes in a category, then votes for a different nominee; the admin tally shows one vote moved, not two votes.
5. Clearing localStorage gives a new device ID (accepted limitation; document it).
6. Before the timer starts and after it ends, vote and nominate requests are rejected by the server, even when sent directly with curl.
7. Extending the timer reopens voting immediately on guest screens.
8. No guest-facing page, API response, or network request exposes vote counts. Verify by inspecting network traffic on the guest pages.
9. `/admin` and every admin API route return unauthorized without the session cookie.
10. Merging two duplicate nominees keeps the total vote count correct and never gives one device two votes in a category.
11. Hiding a nominee removes it from guest views and excludes it from new votes; existing votes for it are excluded from results.
12. The winner reveal view handles a tie and a category with zero votes.
13. Pages are usable at 360 px width and readable in a dark room (dark theme, large tap targets, at least 44 px).

## Deliverables

- Working app deployed to Vercel with a short, memorable URL
- `README.md` with setup steps: Supabase project, SQL migration, Storage bucket, environment variables (`NEXT_PUBLIC_SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `ADMIN_PASSWORD`), and deploy
- Printable QR code (PNG and the `/admin/qr` page)
- A short "party night runbook": how to start, extend, and end voting, and how to show winners

## Design notes

- Halloween theme: dark background, orange and purple accents, playful but readable type.
- Big photos are the whole point. Keep chrome minimal.
- Every state needs a clear message: loading, empty category ("No nominees yet. Be the first!"), upload failed, voting not open, voting closed.
