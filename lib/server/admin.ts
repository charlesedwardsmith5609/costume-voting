// Host session: a signed cookie, verified on the server by every admin route. The cookie holds
// only its expiry and an HMAC-SHA256 signature made with SESSION_SECRET, so no session state is
// stored anywhere. Logout clears the cookie; a copied cookie stays valid until it expires.
import { createHash, createHmac, timingSafeEqual } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import { readCookie } from "./cookies";
import { reject } from "./http";

export const SESSION_COOKIE = "admin_session";
export const SESSION_HOURS = 12;
export const LOGIN_LIMIT = 10;

function secret(): string {
  const s = process.env.SESSION_SECRET;
  if (!s || s.length < 32) throw new Error("SESSION_SECRET must be set (32+ characters)");
  return s;
}

const sign = (payload: string) => createHmac("sha256", secret()).update(payload).digest("base64url");
const sha256 = (s: string) => createHash("sha256").update(s).digest();

// Value for a session that expires at `expiresAtMs`: v1.<expiry ms>.<signature>.
export function sessionValue(expiresAtMs: number): string {
  const payload = `v1.${expiresAtMs}`;
  return `${payload}.${sign(payload)}`;
}

export function isValidSession(value: string | null, nowMs = Date.now()): boolean {
  const m = value?.match(/^(v1\.(\d{1,15}))\.([A-Za-z0-9_-]{43})$/);
  if (!m) return false;
  const expected = Buffer.from(sign(m[1]));
  const given = Buffer.from(m[3]);
  return given.length === expected.length && timingSafeEqual(given, expected) && Number(m[2]) > nowMs;
}

// Every admin route's first line: `const denied = requireAdmin(req); if (denied) return denied;`
export function requireAdmin(req: Request): Response | null {
  return isValidSession(readCookie(req, SESSION_COOKIE)) ? null : reject("admin", "unauthorized");
}

function cookie(value: string, maxAgeSeconds: number, req: Request): string {
  const secure = new URL(req.url).protocol === "https:" ? "; Secure" : "";
  return `${SESSION_COOKIE}=${value}; Max-Age=${maxAgeSeconds}; Path=/; HttpOnly; SameSite=Strict${secure}`;
}

export function sessionCookie(req: Request): string {
  return cookie(sessionValue(Date.now() + SESSION_HOURS * 3600_000), SESSION_HOURS * 3600, req);
}

export function clearedSessionCookie(req: Request): string {
  return cookie("", 0, req);
}

// Constant-time comparison of fixed-length hashes, so timing reveals nothing about the password.
export function passwordMatches(given: unknown): boolean {
  const expected = process.env.ADMIN_PASSWORD;
  if (!expected) throw new Error("ADMIN_PASSWORD must be set");
  return typeof given === "string" && timingSafeEqual(sha256(given), sha256(expected));
}

// The client IP from Vercel's headers ("unknown" locally), hashed into a UUID so login attempts
// can share the rate_limits table, whose key column is a UUID.
export function loginKey(req: Request): string {
  const ip = req.headers.get("x-real-ip") ?? req.headers.get("x-forwarded-for")?.split(",")[0].trim() ?? "unknown";
  const h = createHash("sha256").update(`login:${ip}`).digest("hex");
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20, 32)}`;
}

// Counts one login attempt for this IP; true while within LOGIN_LIMIT per 10-minute window.
// Owner: check_rate_limit (rate_limits, action 'login').
export async function allowLoginAttempt(client: SupabaseClient, req: Request): Promise<boolean> {
  const { data, error } = await client.rpc("check_rate_limit", {
    p_device: loginKey(req),
    p_action: "login",
    p_max: LOGIN_LIMIT,
  });
  if (error) throw error;
  return data === true;
}
