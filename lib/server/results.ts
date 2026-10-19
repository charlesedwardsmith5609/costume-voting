// Host results: per-category tallies, dense ranks, and the CSV export. Admin only.
import type { SupabaseClient } from "@supabase/supabase-js";
import { CATEGORIES, type CategorySlug } from "@/lib/categories";
import { singleLine } from "@/lib/nomineeLabel";
import { thumbPath } from "./supabase";

export type ResultNomineeRow = {
  id: string;
  person_name: string | null;
  costume_name: string | null;
  photo_path: string;
  hidden: boolean;
  nominee_categories: { category: CategorySlug }[];
};
export type VoteRow = { device_id: string; category: CategorySlug; nominee_id: string };

export type ResultEntry = {
  id: string;
  personName: string | null;
  costumeName: string | null;
  label: string;
  photoPath: string;
  hidden: boolean;
  votes: number;
  // Dense rank by votes among non-hidden nominees; null for hidden nominees.
  rank: number | null;
};
export type CategoryResult = { category: CategorySlug; label: string; totalVotes: number; nominees: ResultEntry[] };
export type Results = { categories: CategoryResult[]; distinctDevices: number };

const PAGE = 1000;

// PostgREST returns at most 1000 rows per request, so read every page.
async function readAll<T>(query: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: unknown }>) {
  const rows: T[] = [];
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await query(from, from + PAGE - 1);
    if (error) throw error;
    rows.push(...(data ?? []));
    if ((data ?? []).length < PAGE) return rows;
  }
}

export async function loadResultData(client: SupabaseClient) {
  const nominees = await readAll<ResultNomineeRow>((from, to) =>
    client
      .from("nominees")
      .select("id, person_name, costume_name, photo_path, hidden, nominee_categories(category)")
      .order("id")
      .range(from, to),
  );
  const votes = await readAll<VoteRow>((from, to) =>
    client.from("votes").select("device_id, category, nominee_id").order("device_id").order("category").range(from, to),
  );
  return { nominees, votes };
}

// Non-hidden nominees first, by votes (most first) with dense ranks (1, 1, 2), ties ordered by
// label; then hidden nominees by label with a null rank. Hidden nominees' votes are left out of
// totalVotes and distinctDevices, and are shown on their own entries only.
export function buildResults(nominees: ResultNomineeRow[], votes: VoteRow[]): Results {
  const byId = new Map(nominees.map((n) => [n.id, n]));
  const counts = new Map<string, number>();
  const devices = new Set<string>();
  for (const v of votes) {
    counts.set(`${v.category}:${v.nominee_id}`, (counts.get(`${v.category}:${v.nominee_id}`) ?? 0) + 1);
    if (byId.get(v.nominee_id)?.hidden === false) devices.add(v.device_id);
  }

  const categories = CATEGORIES.map(({ slug, label }): CategoryResult => {
    const entries = nominees
      .filter((n) => n.nominee_categories.some((c) => c.category === slug))
      .map(
        (n): ResultEntry => ({
          id: n.id,
          personName: n.person_name,
          costumeName: n.costume_name,
          label: singleLine({ personName: n.person_name, costumeName: n.costume_name }),
          photoPath: n.photo_path,
          hidden: n.hidden,
          votes: counts.get(`${slug}:${n.id}`) ?? 0,
          rank: null,
        }),
      );
    const byLabel = (a: ResultEntry, b: ResultEntry) => a.label.localeCompare(b.label) || a.id.localeCompare(b.id);
    const visible = entries.filter((e) => !e.hidden).sort((a, b) => b.votes - a.votes || byLabel(a, b));
    const hidden = entries.filter((e) => e.hidden).sort(byLabel);

    let rank = 0;
    let last: number | null = null;
    for (const e of visible) {
      if (e.votes !== last) {
        rank += 1;
        last = e.votes;
      }
      e.rank = rank;
    }
    const totalVotes = visible.reduce((sum, e) => sum + e.votes, 0);
    return { category: slug, label, totalVotes, nominees: [...visible, ...hidden] };
  });
  return { categories, distinctDevices: devices.size };
}

export const CSV_HEADER = ["category", "rank", "display label", "person_name", "costume_name", "votes", "hidden", "photo URL"];

// Guest-typed text that a spreadsheet would run as a formula gets a leading apostrophe.
function csvCell(value: string | number | boolean | null, text = false): string {
  let s = value === null ? "" : String(value);
  if (text && /^[=+\-@\t\r]/.test(s)) s = `'${s}`;
  return /[",\r\n]|^\s|\s$/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

// One row per nominee per category, hidden nominees last in each category with an empty rank.
// Starts with a UTF-8 byte order mark so Excel shows emoji and accents correctly.
export function toCsv(results: Results, toUrl: (path: string) => string): string {
  const lines = [CSV_HEADER.join(",")];
  for (const c of results.categories) {
    for (const n of c.nominees) {
      lines.push(
        [
          csvCell(c.label),
          csvCell(n.rank),
          csvCell(n.label, true),
          csvCell(n.personName, true),
          csvCell(n.costumeName, true),
          csvCell(n.votes),
          csvCell(n.hidden),
          csvCell(toUrl(n.photoPath)),
        ].join(","),
      );
    }
  }
  return `\uFEFF${lines.join("\r\n")}\r\n`;
}

// What guests see once results are published: per category, nominees with at least one vote
// in rank order (ties share a rank), then everyone else as "also nominated" by label. Never
// vote counts; hidden nominees are left out entirely.
export type GuestResultNominee = {
  id: string;
  personName: string | null;
  costumeName: string | null;
  photoUrl: string;
  thumbUrl: string;
};
export type GuestCategoryResult = {
  category: CategorySlug;
  label: string;
  ranked: (GuestResultNominee & { rank: number })[];
  alsoNominated: GuestResultNominee[];
};

export function buildGuestResults(results: Results, toUrl: (path: string) => string): { categories: GuestCategoryResult[] } {
  const guest = (e: ResultEntry): GuestResultNominee => ({
    id: e.id,
    personName: e.personName,
    costumeName: e.costumeName,
    photoUrl: toUrl(e.photoPath),
    thumbUrl: toUrl(thumbPath(e.photoPath)),
  });
  return {
    categories: results.categories.map((c) => {
      const visible = c.nominees.filter((e) => !e.hidden);
      return {
        category: c.category,
        label: c.label,
        ranked: visible.filter((e) => e.votes > 0).map((e) => ({ ...guest(e), rank: e.rank! })),
        alsoNominated: visible.filter((e) => e.votes === 0).sort((a, b) => a.label.localeCompare(b.label)).map(guest),
      };
    }),
  };
}
