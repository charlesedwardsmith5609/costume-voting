# Next.js + Supabase service: state, security, and testing

Load before writing or reviewing server code (route handlers, server actions, SQL migrations).

## 1. Where state lives

- Postgres owns every piece of shared state: settings (timer), nominees, votes, rate limits.
- Route handlers are stateless. Vercel may run many instances or freeze one mid-request, so
  module-level maps, counters, or caches are bugs, not optimizations.
- A write that needs more than one statement (check window + upsert, merge, reset, rate-limit
  check + action) is one Postgres function called via `rpc()`. `supabase-js` has no transactions.
- Time checks use the database `now()`, never `Date.now()` in the route.

## 2. Keys and access

- `SUPABASE_SERVICE_ROLE_KEY` and `SESSION_SECRET` are read only in server modules that start with
  `import "server-only"`-style guards (or live under `lib/server/`). Never prefix them with
  `NEXT_PUBLIC_`. Check the client bundle for the key before deploy.
- RLS is enabled on every table with no anon policies. The browser never queries tables.
- Admin routes verify the signed session cookie on the server on every request. Middleware alone
  is not enough.

## 3. Input handling

- Treat every request body as untrusted: validate types, category slugs, UUIDs, and name length
  (1–60 after trimming) before calling the database. Return 400 with a short message.
- The device ID is client-chosen. Validate it as a UUID; never trust it for anything beyond
  "one vote per device per category".
- Guest responses never include vote counts, rankings, or other devices' votes. Build guest
  responses from an explicit column list, not `select("*")`.

## 4. Storage

- Uploads use signed upload URLs issued by the server for a server-chosen, unguessable path.
- File size and MIME limits are enforced by the bucket configuration.
- Only store a nominee's `photo_path` if it matches a path the server issued.

## 5. Errors and observability

- Map known database errors (window closed, rate limited, not found) to specific 4xx responses
  with friendly messages. Unknown errors are 500 and logged with route name, never the key.
- Log rejections and limit hits; do not log photo data or full request bodies.

## 6. Testing

- Tests run against the separate test Supabase project (`TEST_SUPABASE_URL`,
  `TEST_SUPABASE_SERVICE_ROLE_KEY`). A guard refuses to run if those equal the production values.
- Call route handlers directly with `Request` objects; assert status and response body.
- Control the timer by writing the `settings` row, not by sleeping.
- Cover: vote before open / after close rejected; vote change moves one vote; hidden or
  wrong-category nominee rejected; rate limit trips; admin routes 401 without cookie; merge never
  gives one device two votes; guest responses contain no vote data.

## 7. AI suggestions to reject on sight

- In-memory rate limiting or caching in a route handler.
- Using the service role key in a client component or `NEXT_PUBLIC_` env var.
- Read-then-write in the route for votes or merges instead of one SQL function.
- `select("*")` in a guest-facing response.
- Sorting guest nominee lists by anything derived from votes.
- `setTimeout`/sleep in tests to wait for state.
