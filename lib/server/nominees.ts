// Guest nominee lists. Reads only non-hidden nominees through an explicit column list; nothing
// here touches votes, and every order is by time, never by votes.
import type { SupabaseClient } from "@supabase/supabase-js";
import { CATEGORIES, type CategorySlug } from "@/lib/categories";
import type { GuestNominee } from "@/lib/types";
import { photoUrl, thumbPath } from "./supabase";

export const STRIP_SIZE = 12;
export const MIN_QUERY_LENGTH = 2;

export type NomineeRow = {
  id: string;
  person_name: string | null;
  costume_name: string | null;
  photo_path: string;
  created_at: string;
  nominee_categories: { category: CategorySlug; added_at: string }[];
};

export type NomineeLists = {
  nominees: GuestNominee[];
  strips: { here: GuestNominee[]; elsewhere: GuestNominee[] };
  matches?: { here: GuestNominee[]; elsewhere: GuestNominee[] };
};

export async function loadNominees(client: SupabaseClient): Promise<NomineeRow[]> {
  const { data, error } = await client
    .from("nominees")
    .select("id, person_name, costume_name, photo_path, created_at, nominee_categories(category, added_at)")
    .eq("hidden", false);
  if (error) throw error;
  return data as NomineeRow[];
}

// Newest first; equal timestamps fall back to id so the order is stable.
const newestFirst = (a: [string, string], b: [string, string]) =>
  a[0] === b[0] ? a[1].localeCompare(b[1]) : a[0] < b[0] ? 1 : -1;

function toGuest(r: NomineeRow, toUrl: (path: string) => string): GuestNominee {
  const order = CATEGORIES.map((c) => c.slug);
  return {
    id: r.id,
    personName: r.person_name,
    costumeName: r.costume_name,
    categories: r.nominee_categories.map((c) => c.category).sort((a, b) => order.indexOf(a) - order.indexOf(b)),
    photoUrl: toUrl(r.photo_path),
    thumbUrl: toUrl(thumbPath(r.photo_path)),
  };
}

// Builds the category list (newest added to this category first), the two "Already
// nominated?" strips, and, when queries are given, name matches in and outside the category.
// Queries shorter than MIN_QUERY_LENGTH are ignored; photo-only nominees never match.
export function buildNomineeLists(
  rows: NomineeRow[],
  category: CategorySlug,
  queries: string[],
  toUrl: (path: string) => string,
): NomineeLists {
  const guest = (r: NomineeRow) => toGuest(r, toUrl);
  const addedAt = (r: NomineeRow) => r.nominee_categories.find((c) => c.category === category)?.added_at;

  const here = rows
    .filter((r) => addedAt(r) !== undefined)
    .sort((a, b) => newestFirst([addedAt(a)!, a.id], [addedAt(b)!, b.id]));
  const elsewhere = rows
    .filter((r) => addedAt(r) === undefined)
    .sort((a, b) => newestFirst([a.created_at, a.id], [b.created_at, b.id]));

  const lists: NomineeLists = {
    nominees: here.map(guest),
    strips: { here: here.slice(0, STRIP_SIZE).map(guest), elsewhere: elsewhere.slice(0, STRIP_SIZE).map(guest) },
  };

  const terms = queries.map((q) => q.trim().toLowerCase()).filter((q) => q.length >= MIN_QUERY_LENGTH);
  if (terms.length > 0) {
    const matches = (r: NomineeRow) =>
      [r.person_name, r.costume_name].some((name) => name && terms.some((t) => name.toLowerCase().includes(t)));
    lists.matches = { here: here.filter(matches).map(guest), elsewhere: elsewhere.filter(matches).map(guest) };
  }
  return lists;
}

export function nomineeLists(client: SupabaseClient, rows: NomineeRow[], category: CategorySlug, queries: string[]) {
  return buildNomineeLists(rows, category, queries, (path) => photoUrl(client, path));
}

