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
6. **Fast nomination.** Adding a nominee takes under 30 seconds: take or pick a photo, optionally type names, choose one or more categories, submit.

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

- Grid of nominee cards: photo (square crop, large) and the nominee's label (see "Nominee labels").
- Every card has an "Edit" link (see "Edit a nominee").
- Tap a card to select it, then a clear "Vote" button. Tapping a different nominee and voting again **changes** this device's vote (one vote per device per category, last vote wins until voting closes).
- Show "Your vote: [label]" at the top once voted.
- Prominent "+ Add a nominee" button.
- Light search or filter by name once a category has more than about 8 nominees.
- Nominees sorted alphabetically or by time added. Never sorted by votes.

### Add a nominee

- Photo: one button that opens the camera on phones, with the option to choose from the library (`<input type="file" accept="image/*" capture="environment">` plus a second plain file input, or equivalent).
- Two optional name fields, each max 60 characters: person name ("Who is it?", e.g. "Sam") and costume name ("What are they?", e.g. "The Mad Hatter"). Names are trimmed; blank means no name. A photo-only nominee is allowed.
- Category checkboxes for all four categories, with the current category pre-checked. At least one must be checked.
- "Already nominated?" to reduce duplicates:
  - A strip of the newest 12 non-hidden nominees in this category.
  - A second strip, "Already nominated elsewhere": the newest 12 non-hidden nominees not yet in this category, each with an "Add to this category" button.
  - Once a name has been typed, nominees whose person or costume name matches are shown too. Matches already in this category are just shown; matches elsewhere get "Add [label] to [this category]". Photo-only nominees appear only in the photo strips, never in name matches.
  - "Add to this category" adds the existing nominee (no new photo) and returns to the category screen.
- Compress the photo on the device before upload: max 1600 px on the long side, JPEG around 0.8 quality, target under 500 KB. Strip EXIF location data. Correct EXIF orientation.
- Show upload progress and a friendly retry on failure, keeping the entered name and photo.
- After success, return to the category screen with the new nominee visible. Do not auto-vote.

### Edit a nominee

Anyone can edit any nominee (no ownership checks; it's a party among friends).

- Guests can change the person name and costume name, replace the photo (same compression and upload flow as adding), and add categories. Guests cannot remove a category.
- Edits are accepted only while voting is open. After voting closes, only the host can edit.
- Every edit is logged with the device, the old and new values, and the old photo. Replaced photos are never deleted, so the host can undo any edit.

### Nominee labels

- Both names: "Sam as The Mad Hatter". On cards, two lines: person name on top, costume name below in smaller text.
- Person only: "Sam".
- Costume only: "The Mad Hatter".
- Photo only: "Mystery guest 👻", and the card shows a "Know who this is? Add their name" link to the edit screen.
- Single-line contexts (admin results, CSV display label, winner reveal) use the "Sam as The Mad Hatter" form.

### Device identity

- On first visit, generate a random device ID (UUID) and keep it in localStorage, with a cookie fallback.
- One vote per device per category, enforced by a unique constraint in the database.
- This is intentionally not tamper-proof. It's a friendly party contest; don't add sign-in to harden it.

## Host (admin) experience

- Route: `/admin`, protected by a password from an environment variable (`ADMIN_PASSWORD`). Use an httpOnly session cookie after login. Every admin API route checks it on the server.
- **Timer controls:** start with a duration picker (default 30 minutes), extend by 5 or 10 minutes, end now, and reopen.
- **Live results:** per category, nominees ranked by vote count with photo thumbnails, auto-refreshing every few seconds (or Supabase Realtime). Show total votes per category and number of distinct voting devices.
- **Winner reveal view:** a full-screen view showing the winner of each category with their photo, one at a time, for announcing on a TV or the host's phone. Handle ties by showing all tied nominees.
- **Nominee moderation:**
  - Hide or delete a nominee. Hiding removes it from every category.
  - Edit names and photo at any time, including after voting closes.
  - Add or remove categories per nominee. Removing a nominee from a category deletes its votes in that category only. A nominee's last category cannot be removed; hide or delete it instead.
  - Merge duplicates: the kept nominee keeps its names and photo, gains the other's categories, and receives its votes. In each category, a device that voted for both ends up with one vote.
- **Edit history:** per nominee, every edit (who: a device or the host; old and new names, photo, and categories; when) with a one-click "Undo this edit". Undo restores the values that edit changed, even if later edits changed them again; undoing a category add removes that category and its votes. Each undo is logged as a host edit and can itself be undone.
- **CSV export:** one row per nominee per category with columns: category, rank, display label, person_name, costume_name, votes, hidden, photo URL.
  - Rank is dense by vote count within the category: tied nominees share a rank and the next rank follows on (1, 1, 2).
  - Hidden nominees are listed at the bottom of each category with an empty rank and hidden = true, so they never look like they placed.
- **QR code page:** shows a large, printable QR code for the guest URL with the text "Scan to vote for best costume!" and the categories listed.
- **Reset:** a guarded "clear all votes and nominees" action for testing, requiring the host to type RESET.

## Data model

```sql
create table settings (
  id int primary key default 1 check (id = 1),
  voting_opens_at timestamptz,
  voting_closes_at timestamptz
);

-- One row per costume. Names are null when blank.
create table nominees (
  id uuid primary key default gen_random_uuid(),
  person_name text check (person_name is null or char_length(person_name) between 1 and 60),
  costume_name text check (costume_name is null or char_length(costume_name) between 1 and 60),
  photo_path text not null,
  created_by_device uuid not null,
  hidden boolean not null default false,
  created_at timestamptz not null default now()
);

-- A nominee appears in every category it has a row for.
create table nominee_categories (
  nominee_id uuid not null references nominees(id) on delete cascade,
  category text not null check (category in
    ('most_elaborate','most_unique','funniest','best_couples')),
  added_at timestamptz not null default now(),
  primary key (nominee_id, category)
);

create table votes (
  device_id uuid not null,
  category text not null,
  nominee_id uuid not null,
  updated_at timestamptz not null default now(),
  primary key (device_id, category),
  foreign key (nominee_id, category)
    references nominee_categories (nominee_id, category) on delete cascade
);

-- Every edit, including category changes and undos. device_id is null for the host.
create table nominee_edits (
  id bigint generated always as identity primary key,
  nominee_id uuid not null references nominees(id) on delete cascade,
  device_id uuid,
  old_person_name text, new_person_name text,
  old_costume_name text, new_costume_name text,
  old_photo_path text not null, new_photo_path text not null,
  added_categories text[] not null default '{}',
  removed_categories text[] not null default '{}',
  undoes_edit_id bigint references nominee_edits(id) on delete set null,
  created_at timestamptz not null default now()
);
```

`settings` and `rate_limits` are as in `supabase/migrations/0001_init.sql`, which is the source of truth.

- Enable Row Level Security on all tables with **no policies for the anon role**, so the browser cannot read or write tables directly. All access goes through server routes using the service role.
- The Supabase projects have "Automatically expose new tables" disabled. The migration grants `service_role` select, insert, update, and delete on every table, usage on the `nominee_edits` sequence, and execute on every function. `anon` and `authenticated` get nothing.
- Every multi-step write is one Postgres function: `cast_vote`, `create_nominee`, `add_nominee_to_category`, `edit_nominee` (guest); `set_timer`, `admin_edit_nominee`, `admin_set_category`, `undo_nominee_edit`, `merge_nominees`, `reset_all` (host).
- Voting is an upsert on `(device_id, category)`. The server checks that the nominee exists, isn't hidden, is in that category (`nominee_categories`), and that `now()` is between `voting_opens_at` and `voting_closes_at`.
- Nominating, adding to a category, and guest edits check the same time window. Host edits do not.
- The request start time counts: window checks use the database clock at the start of the request's transaction. A request that started before voting closed is accepted even if it finishes a few milliseconds after, for example while waiting on a row lock.
- A new or replacement photo must be an uploaded object at `<device>/<uuid>.jpg` (or `host/<uuid>.jpg` for the host) that no nominee or edit has used before. A unique index on `nominees.photo_path` backs this up.
- Public API returns only nominee id, person name, costume name, categories, and photo URL, never vote data. The only vote data a guest can get is their own device's current pick per category.

## Abuse and safety (keep it light)

- Rate limit per device: at most 10 nominations, 10 edits (edits and "Add to this category" share this counter), and 60 vote requests per 10 minutes.
- Reject uploads that aren't images or are over 5 MB after compression.
- Host can hide any nominee instantly.
- No personal data collected beyond what guests type as nominee names.

## Non-goals

- No user accounts, social login, comments, or sharing.
- No public leaderboard.
- No native app.

## Acceptance tests

Write automated tests where practical (server route tests for voting and timer rules) and run the rest manually on real phones (at least one iPhone with Safari and one Android with Chrome).

1. A new guest scans the QR code and reaches the home screen in under 3 seconds on a phone.
2. A guest can add a nominee using the phone camera in one or more categories, and it appears in each chosen category for a second phone within 5 seconds of refreshing.
3. A 12 MB phone photo uploads successfully after compression, oriented correctly, with no GPS data in the stored file. Manual check: take a real photo with location enabled on each test phone, upload it, download the stored file from the bucket, and confirm with an EXIF viewer (e.g., `exiftool`) that it has no GPS tags and displays upright.
4. A device votes in a category, then votes for a different nominee; the admin tally shows one vote moved, not two votes.
5. Clearing localStorage gives a new device ID (accepted limitation; document it).
6. Before the timer starts and after it ends, vote, nominate, add-to-category, and guest edit requests are rejected by the server, even when sent directly with curl.
7. Extending the timer reopens voting immediately on guest screens.
8. No guest-facing page, API response, or network request exposes vote counts. Verify by inspecting network traffic on the guest pages.
9. `/admin` and every admin API route return unauthorized without the session cookie.
10. Merging two duplicate nominees unions their categories, keeps the total vote count correct per category, and never gives one device two votes in a category.
11. Hiding a nominee removes it from guest views in every category and excludes it from new votes; existing votes for it are excluded from results.
12. The winner reveal view handles a tie and a category with zero votes.
13. Pages are usable at 360 px width and readable in a dark room (dark theme, large tap targets, at least 44 px).
14. A nominee in two categories appears in both, and a device can vote for it in each.
15. From "Already nominated elsewhere" or a name match, "Add to this category" adds the existing nominee without a new photo upload.
16. Removing a nominee from a category deletes its votes in that category only; the host cannot remove its last category.
17. A guest edits a nominee's names and photo: the card updates, the admin edit history shows the old and new values, and "Undo this edit" restores them, including the photo. The undo appears in the history and can itself be undone.
18. After voting closes, a guest edit is rejected by the server; a host edit still works.
19. The anon (publishable) key cannot call any database function, including `edit_nominee`, or read or write any table; the service role (secret) key can do all of these.
20. A photo-only nominee shows "Mystery guest 👻" with a "Know who this is? Add their name" link; a nominee with both names shows two lines on the card and "Sam as The Mad Hatter" in single-line contexts.
21. The CSV export has one row per nominee per category with the listed columns; tied nominees share a rank (1, 1, 2), and hidden nominees are at the bottom with an empty rank.

## Deliverables

- Working app deployed to Vercel with a short, memorable URL
- `README.md` with setup steps: Supabase project, SQL migration, Storage bucket, environment variables (`NEXT_PUBLIC_SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` (the project's `sb_secret_` key), `ADMIN_PASSWORD`), and deploy
- Printable QR code (PNG and the `/admin/qr` page)
- A short "party night runbook": how to start, extend, and end voting, and how to show winners. It must say: never run Reset while guests are nominating or voting (it is for testing before the party).

## Design notes

- Halloween theme: dark background, orange and purple accents, playful but readable type.
- Big photos are the whole point. Keep chrome minimal.
- Every state needs a clear message: loading, empty category ("No nominees yet. Be the first!"), upload failed, voting not open, voting closed.
