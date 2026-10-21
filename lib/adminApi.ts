// Browser client for the admin API routes. The session is the HttpOnly cookie set by login, so
// requests carry no credentials of their own. Errors become ApiError with the route's error code
// ("unauthorized" when the session is missing or expired), or "network".
import { ApiError, type IssuedUpload, type NameFields } from "./api";
import type { CategorySlug } from "./categories";
import type { NomineeEdit } from "./editHistory";
import type { RevealCommand, RevealState } from "./revealRemote";

export async function adminRequest<T>(path: string, body?: unknown): Promise<T> {
  let res: Response;
  try {
    res = await fetch(
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

export async function hasSession(): Promise<boolean> {
  try {
    await adminRequest("/api/admin/session");
    return true;
  } catch (err) {
    if (err instanceof ApiError && err.code === "unauthorized") return false;
    throw err;
  }
}

export const login = (password: string) => adminRequest("/api/admin/login", { password });
export const logout = () => adminRequest("/api/admin/logout", {});

// Host-facing copy for admin error codes.
const MESSAGES: Record<string, string> = {
  wrong_password: "Wrong password",
  rate_limited: "Too many tries. Wait a few minutes and try again.",
  unauthorized: "Your session expired. Log in again.",
  network: "Couldn't reach the server. Check your connection.",
  invalid_timer: "That closing time or duration isn't valid. Pick a time in the future.",
  not_started: "Voting hasn't been started yet.",
  not_closed: "Results can be published only after voting closes.",
  not_found: "That nominee no longer exists.",
  same_nominee: "Pick a different nominee.",
  confirm_required: "Type RESET to confirm.",
  last_category: "A nominee needs at least one category. Hide or delete it instead.",
  invalid_name: "Names can be up to 60 characters.",
  invalid_photo: "Photo upload failed. Try again.",
  upload_failed: "Photo upload failed. Try again.",
  no_change: "Nothing to undo. Those values are already restored.",
};

export function adminErrorMessage(code: string): string {
  return MESSAGES[code] ?? "Something went wrong. Try again.";
}

export type TimerResult = { votingOpensAt: string; votingClosesAt: string };
export const startTimer = (body: { closesAt: string } | { minutes: number }) =>
  adminRequest<TimerResult>("/api/admin/timer", { action: "start", ...body });
export const extendTimer = (minutes: number) => adminRequest<TimerResult>("/api/admin/timer", { action: "extend", minutes });
export const setPublished = (published: boolean) =>
  adminRequest<{ resultsPublished: boolean }>("/api/admin/publish", { published });
export const endVoting = () => adminRequest<TimerResult>("/api/admin/timer", { action: "end" });

// Live results for the host (/api/admin/results): non-hidden nominees per category with vote
// counts and dense ranks, total votes per category, and distinct voting devices overall.
export type AdminResultNominee = {
  id: string;
  personName: string | null;
  costumeName: string | null;
  label: string;
  votes: number;
  rank: number;
  photoUrl: string;
  thumbUrl: string;
};
export type AdminCategoryResult = { category: CategorySlug; label: string; totalVotes: number; nominees: AdminResultNominee[] };
export type AdminResults = { distinctDevices: number; categories: AdminCategoryResult[] };
export const fetchAdminResults = () => adminRequest<AdminResults>("/api/admin/results");

// Every nominee, hidden ones included, newest first (/api/admin/nominees).
export type AdminNominee = {
  id: string;
  personName: string | null;
  costumeName: string | null;
  photoUrl: string;
  thumbUrl: string;
  hidden: boolean;
  createdAt: string;
  categories: CategorySlug[];
};
export const fetchAdminNominees = () => adminRequest<{ nominees: AdminNominee[] }>("/api/admin/nominees");
export const setHidden = (nomineeId: string, hidden: boolean) => adminRequest("/api/admin/hide", { nomineeId, hidden });
export const deleteNominee = (nomineeId: string) => adminRequest("/api/admin/delete", { nomineeId });
export const adminUploadUrl = () => adminRequest<IssuedUpload>("/api/admin/upload-url", {});
export const adminEditNominee = (body: NameFields & { nomineeId: string; photoPath?: string }) =>
  adminRequest("/api/admin/edit", body);
export const setCategory = (nomineeId: string, category: CategorySlug, present: boolean) =>
  adminRequest("/api/admin/set-category", { nomineeId, category, present });

// Edit history for one nominee, newest first (/api/admin/edits).
export type { NomineeEdit };
export const fetchEdits = (nomineeId: string) =>
  adminRequest<{ edits: NomineeEdit[] }>(`/api/admin/edits?nomineeId=${encodeURIComponent(nomineeId)}`);
export const undoEdit = (editId: number) => adminRequest("/api/admin/undo", { editId });
export const mergeNominees = (keepId: string, dropId: string) => adminRequest("/api/admin/merge", { keepId, dropId });
export type ResetResult = { ok: true; photosRemoved: number; photosNotRemoved: number };
export const resetAll = () => adminRequest<ResetResult>("/api/admin/reset", { confirm: "RESET" });

// Every photo for the final slideshow (/api/admin/photos), including ones the host removed.
export type SlideshowSource = "current" | "hidden" | "earlier" | "unused";
export type SlideshowPhoto = {
  path: string;
  label: string | null;
  source: SlideshowSource;
  excluded: boolean;
  photoUrl: string;
  thumbUrl: string;
};
export const fetchSlideshowPhotos = () => adminRequest<{ photos: SlideshowPhoto[] }>("/api/admin/photos");
export const setSlideshowExcluded = (photoPath: string, excluded: boolean) =>
  adminRequest("/api/admin/slideshow-exclude", { photoPath, excluded });

// Phone remote for the winner reveal (/api/admin/reveal-remote, /api/admin/reveal-state).
export type RevealRemote = { seq: number; command: RevealCommand | null; state: RevealState | null; tvConnected: boolean };
export const fetchRevealRemote = () => adminRequest<RevealRemote>("/api/admin/reveal-remote");
export const sendRevealCommand = (command: RevealCommand) =>
  adminRequest<{ seq: number }>("/api/admin/reveal-remote", { command });
export const publishRevealState = (state: RevealState) => adminRequest("/api/admin/reveal-state", { state });
