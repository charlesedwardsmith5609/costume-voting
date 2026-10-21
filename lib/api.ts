// Browser client for the guest API routes. Every call sends the device ID (guestFetch). Errors
// become ApiError with the route's error code, or "network" when the request never completed.
import type { CategorySlug } from "./categories";
import { guestFetch } from "./deviceId";
import type { GuestCategoryResult, GuestNominee, GuestState } from "./types";

export class ApiError extends Error {
  constructor(public code: string) {
    super(code);
  }
}

async function request<T>(path: string, body?: unknown): Promise<T> {
  let res: Response;
  try {
    res = await guestFetch(
      path,
      body === undefined
        ? { cache: "no-store" }
        : { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) },
    );
  } catch {
    throw new ApiError("network");
  }
  const data = await res.json().catch(() => null);
  if (!res.ok) throw new ApiError(typeof data?.error === "string" ? data.error : "server_error");
  return data as T;
}

// The state plus the phone's clock offset, measured around this request.
export async function fetchState(): Promise<{ state: GuestState; sentAt: number; receivedAt: number }> {
  const sentAt = Date.now();
  const state = await request<GuestState>("/api/state");
  return { state, sentAt, receivedAt: Date.now() };
}

export type NomineeLists = {
  nominees: GuestNominee[];
  strips: { here: GuestNominee[]; elsewhere: GuestNominee[] };
  matches?: { here: GuestNominee[]; elsewhere: GuestNominee[] };
};

export function fetchNominees(category: CategorySlug, queries: string[] = []): Promise<NomineeLists> {
  const params = new URLSearchParams({ category });
  for (const q of queries) params.append("q", q);
  return request(`/api/nominees?${params}`);
}

// Every non-hidden nominee, newest first, for the "Nominate a costume" picker.
export async function fetchAllNominees(): Promise<GuestNominee[]> {
  return (await request<{ nominees: GuestNominee[] }>("/api/nominees")).nominees;
}

// 403 not_published until the host publishes results.
export async function fetchResults(): Promise<GuestCategoryResult[]> {
  return (await request<{ categories: GuestCategoryResult[] }>("/api/results")).categories;
}

export async function fetchMyVotes(): Promise<Partial<Record<CategorySlug, string>>> {
  return (await request<{ votes: Partial<Record<CategorySlug, string>> }>("/api/my-votes")).votes;
}

export const castVote = (category: CategorySlug, nomineeId: string) => request("/api/vote", { category, nomineeId });

export type IssuedUpload = { path: string; signedUrl: string; thumbSignedUrl: string };
export const issueUpload = () => request<IssuedUpload>("/api/upload-url", {});

export type NameFields = { personName: string | null; costumeName: string | null };

export const nominate = (body: NameFields & { categories: CategorySlug[]; photoPath: string }) =>
  request<{ id: string }>("/api/nominate", body);

export const addToCategories = (nomineeId: string, categories: CategorySlug[]) =>
  request("/api/add-to-category", { nomineeId, categories });

export const editNominee = (
  body: NameFields & { nomineeId: string; photoPath?: string; addCategories: CategorySlug[] },
) => request("/api/edit", body);
