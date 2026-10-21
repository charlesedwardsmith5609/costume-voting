import { randomUUID } from "node:crypto";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

export const BUCKET = "nominee-photos";

function requireEnv(name: string): string {
  const v = process.env[name];
  if (!v) {
    throw new Error(
      `${name} is not set. DB tests need the separate test Supabase project in .env.local ` +
        `(see .env.example).`,
    );
  }
  return v;
}

const url = requireEnv("TEST_SUPABASE_URL");
const serviceKey = requireEnv("TEST_SUPABASE_SERVICE_ROLE_KEY");
const anonKey = requireEnv("TEST_SUPABASE_ANON_KEY");

// The project ID is the first label of <id>.supabase.co; for any other host, the whole host.
function projectId(value: string): string {
  const host = new URL(value).hostname.toLowerCase();
  return host.endsWith(".supabase.co") ? host.split(".")[0] : host;
}

// These tests wipe the database. Refuse to point them at production.
const prodUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
if (prodUrl && projectId(url) === projectId(prodUrl)) {
  throw new Error("TEST_SUPABASE_URL is the same project as NEXT_PUBLIC_SUPABASE_URL; refusing to run DB tests.");
}
if (serviceKey === process.env.SUPABASE_SERVICE_ROLE_KEY) {
  throw new Error("TEST_SUPABASE_SERVICE_ROLE_KEY equals the production key; refusing to run.");
}

const opts = { auth: { persistSession: false, autoRefreshToken: false } };
export const admin: SupabaseClient = createClient(url, serviceKey, opts);
export const anon: SupabaseClient = createClient(url, anonKey, opts);

// Only a project marked by supabase/test_marker.sql may be wiped. Runs when this module loads,
// before any test file's beforeEach(resetDb).
{
  const { data, error } = await admin.from("test_marker").select("id").eq("id", 1).maybeSingle();
  if (error || !data) {
    throw new Error(
      `Test project ${projectId(url)} has no test_marker row (${error?.message ?? "table is empty"}). ` +
        "Run supabase/test_marker.sql on the test project only; refusing to run DB tests.",
    );
  }
}

export type Status = { status: string; id?: string; edit_id?: number };

export async function rpc<T>(fn: string, args: Record<string, unknown> = {}): Promise<T> {
  const { data, error } = await admin.rpc(fn, args);
  if (error) throw new Error(`${fn}: ${error.code} ${error.message}`);
  return data as T;
}

export async function resetDb(): Promise<void> {
  const paths = await rpc<string[]>("reset_all");
  const all = paths.flatMap((p) => [p, p.replace(/\.jpg$/, ".thumb.jpg")]);
  for (let i = 0; i < all.length; i += 100) await admin.storage.from(BUCKET).remove(all.slice(i, i + 100));
}

export async function openVoting(minutes = 30): Promise<void> {
  await rpc("set_timer", { p_action: "start", p_minutes: minutes });
}

export async function closeVoting(): Promise<void> {
  await rpc("set_timer", { p_action: "end" });
}

export async function getSettings(): Promise<{ voting_opens_at: string | null; voting_closes_at: string | null }> {
  const { data, error } = await admin.from("settings").select("voting_opens_at, voting_closes_at").single();
  if (error) throw new Error(error.message);
  return data;
}

// Uploads a tiny placeholder object the way the functions expect it: for "host", at
// host/<uuid>.jpg; for a device ID, at guest/<uuid>.jpg with a photo_uploads row recording that
// device, as issue_upload does (without its voting window and rate limit).
export async function uploadPhoto(owner: string): Promise<string> {
  const path = `${owner === "host" ? "host" : "guest"}/${randomUUID()}.jpg`;
  if (owner !== "host") {
    const { error } = await admin.from("photo_uploads").insert({ path, device_id: owner });
    if (error) throw new Error(`photo_uploads: ${error.message}`);
  }
  const bytes = new Uint8Array([0xff, 0xd8, 0xff, 0xd9]);
  const { error } = await admin.storage.from(BUCKET).upload(path, bytes, { contentType: "image/jpeg" });
  if (error) throw new Error(`upload: ${error.message}`);
  return path;
}

// Creates a nominee through create_nominee (voting must be open).
export async function createNominee(
  device: string,
  categories: string | string[],
  person: string | null = "Alex",
  costume: string | null = null,
): Promise<string> {
  const photo = await uploadPhoto(device);
  const res = await rpc<Status>("create_nominee", {
    p_device: device,
    p_categories: Array.isArray(categories) ? categories : [categories],
    p_person_name: person,
    p_costume_name: costume,
    p_photo_path: photo,
  });
  if (res.status !== "ok" || !res.id) throw new Error(`create_nominee: ${res.status}`);
  return res.id;
}

// Inserts a nominee directly, for states the functions refuse to create (e.g. voting not open).
export async function seedNominee(categories: string[], person = "Alex"): Promise<string> {
  const { data, error } = await admin
    .from("nominees")
    .insert({ person_name: person, photo_path: `seed/${randomUUID()}.jpg`, created_by_device: randomUUID() })
    .select("id")
    .single();
  if (error) throw new Error(error.message);
  const rows = categories.map((category) => ({ nominee_id: data.id, category }));
  const { error: catError } = await admin.from("nominee_categories").insert(rows);
  if (catError) throw new Error(catError.message);
  return data.id;
}

export type NomineeRow = {
  person_name: string | null;
  costume_name: string | null;
  photo_path: string;
  hidden: boolean;
};

export async function getNominee(id: string): Promise<NomineeRow> {
  const { data, error } = await admin
    .from("nominees")
    .select("person_name, costume_name, photo_path, hidden")
    .eq("id", id)
    .single();
  if (error) throw new Error(error.message);
  return data;
}

export async function categoriesOf(id: string): Promise<string[]> {
  const { data, error } = await admin.from("nominee_categories").select("category").eq("nominee_id", id);
  if (error) throw new Error(error.message);
  return data.map((r) => r.category).sort();
}

export async function votesFor(nomineeId: string, category?: string): Promise<number> {
  let q = admin.from("votes").select("*", { count: "exact", head: true }).eq("nominee_id", nomineeId);
  if (category) q = q.eq("category", category);
  const { count, error } = await q;
  if (error) throw new Error(error.message);
  return count ?? 0;
}

// Sets this device's counter for the current window (by the database clock) to `count`, so a
// limit test needs only one or two more requests instead of crossing a window boundary.
export async function fillRateLimit(device: string, action: string, count: number): Promise<void> {
  await rpc("check_rate_limit", { p_device: device, p_action: action, p_max: count });
  const { error } = await admin.from("rate_limits").update({ count }).eq("device_id", device).eq("action", action);
  if (error) throw new Error(`fillRateLimit: ${error.message}`);
}

export async function countRows(table: string): Promise<number> {
  const { count, error } = await admin.from(table).select("*", { count: "exact", head: true });
  if (error) throw new Error(`${table}: ${error.message}`);
  return count ?? 0;
}

export const newDevice = (): string => randomUUID();

const id = () => randomUUID();

// Every function in the migration with well-formed arguments. The service role must be able to
// call each one (the result status does not matter); the anon key must be rejected for each.
export const FUNCTION_CALLS: Array<[string, Record<string, unknown>]> = [
  ["voting_is_open", {}],
  ["check_rate_limit", { p_device: id(), p_action: "vote", p_max: 60 }],
  ["valid_categories", { p_categories: ["funniest"] }],
  ["clean_name", { p_name: " Sam " }],
  ["valid_name", { p_name: "Sam" }],
  ["photo_is_fresh", { p_owner: "host", p_path: "host/x.jpg" }],
  [
    "apply_nominee_edit",
    {
      p_nominee: id(),
      p_device: id(),
      p_guest: true,
      p_person_name: "Sam",
      p_costume_name: null,
      p_photo_path: null,
      p_add: [],
      p_remove: [],
      p_undoes: null,
    },
  ],
  ["cast_vote", { p_device: id(), p_category: "funniest", p_nominee: id() }],
  [
    "create_nominee",
    { p_device: id(), p_categories: ["funniest"], p_person_name: "x", p_costume_name: null, p_photo_path: "x.jpg" },
  ],
  ["add_nominee_to_category", { p_device: id(), p_nominee: id(), p_category: "funniest" }],
  ["add_nominee_to_categories", { p_device: id(), p_nominee: id(), p_categories: ["funniest"] }],
  [
    "edit_nominee",
    { p_device: id(), p_nominee: id(), p_person_name: "x", p_costume_name: null, p_photo_path: null, p_add_categories: [] },
  ],
  ["set_timer", { p_action: "start", p_minutes: 30 }],
  ["set_timer", { p_action: "start", p_closes_at: new Date(Date.now() + 3600000).toISOString() }],
  ["guest_state", {}],
  ["set_results_published", { p_published: false }],
  ["issue_upload", { p_device: id() }],
  [
    "admin_edit_nominee",
    { p_nominee: id(), p_person_name: "x", p_costume_name: null, p_photo_path: null, p_add_categories: [] },
  ],
  ["admin_set_category", { p_nominee: id(), p_category: "funniest", p_present: false }],
  ["undo_nominee_edit", { p_edit_id: 1 }],
  ["merge_nominees", { p_keep: id(), p_drop: id() }],
  ["reset_all", {}],
];

export const TABLES = [
  "settings",
  "nominees",
  "nominee_categories",
  "votes",
  "nominee_edits",
  "rate_limits",
  "photo_uploads",
  "slideshow_exclusions",
];
