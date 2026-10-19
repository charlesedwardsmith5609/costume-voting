// Browser client for the admin API routes. The session is the HttpOnly cookie set by login, so
// requests carry no credentials of their own. Errors become ApiError with the route's error code
// ("unauthorized" when the session is missing or expired), or "network".
import { ApiError } from "./api";

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
