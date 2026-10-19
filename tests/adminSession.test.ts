import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  clearedSessionCookie,
  isValidSession,
  loginKey,
  passwordMatches,
  requireAdmin,
  sessionCookie,
  sessionValue,
} from "@/lib/server/admin";

beforeEach(() => {
  vi.stubEnv("SESSION_SECRET", "unit-test-secret-0123456789abcdefghij");
  vi.stubEnv("ADMIN_PASSWORD", "pumpkin");
});
afterEach(() => vi.unstubAllEnvs());

const hour = 3600_000;

describe("admin session", () => {
  it("accepts its own unexpired session and rejects expired, tampered, and malformed ones", () => {
    const now = Date.now();
    expect(isValidSession(sessionValue(now + hour), now)).toBe(true);
    expect(isValidSession(sessionValue(now - 1), now)).toBe(false);
    const [v, exp, sig] = sessionValue(now + hour).split(".");
    expect(isValidSession(`${v}.${Number(exp) + hour}.${sig}`, now)).toBe(false);
    expect(isValidSession(`${v}.${exp}.${sig.slice(0, -1)}${sig.endsWith("A") ? "B" : "A"}`, now)).toBe(false);
    expect(isValidSession(null, now)).toBe(false);
    expect(isValidSession("", now)).toBe(false);
    expect(isValidSession("v1.123", now)).toBe(false);
  });

  it("rejects a session signed with a different secret", () => {
    const value = sessionValue(Date.now() + hour);
    vi.stubEnv("SESSION_SECRET", "another-secret-0123456789abcdefghijkl");
    expect(isValidSession(value)).toBe(false);
  });

  it("refuses to sign with a missing or short secret", () => {
    vi.stubEnv("SESSION_SECRET", "short");
    expect(() => sessionValue(Date.now())).toThrow(/SESSION_SECRET/);
  });

  it("requireAdmin returns 401 without a valid cookie and null with one", async () => {
    const res = requireAdmin(new Request("https://x/api/admin/results"));
    expect(res!.status).toBe(401);
    expect((await res!.json()).error).toBe("unauthorized");
    const ok = new Request("https://x/api/admin/results", {
      headers: { cookie: `theme=dark; admin_session=${sessionValue(Date.now() + hour)}` },
    });
    expect(requireAdmin(ok)).toBeNull();
  });

  it("sets an HttpOnly, SameSite=Strict, 12-hour cookie, Secure on https only, and clears it", () => {
    const https = sessionCookie(new Request("https://party.example/api/admin/login"));
    expect(https).toMatch(/^admin_session=v1\.\d+\.[\w-]{43}; Max-Age=43200; Path=\/; HttpOnly; SameSite=Strict; Secure$/);
    expect(sessionCookie(new Request("http://localhost/api/admin/login"))).not.toContain("Secure");
    expect(clearedSessionCookie(new Request("https://x/"))).toMatch(/^admin_session=; Max-Age=0;/);
  });
});

describe("passwordMatches", () => {
  it("matches only the exact password", () => {
    expect(passwordMatches("pumpkin")).toBe(true);
    expect(passwordMatches("Pumpkin")).toBe(false);
    expect(passwordMatches("pumpkin ")).toBe(false);
    expect(passwordMatches(undefined)).toBe(false);
    expect(passwordMatches(42)).toBe(false);
  });
});

describe("loginKey", () => {
  it("hashes the client IP into a stable UUID-shaped key", () => {
    const key = (h: Record<string, string>) => loginKey(new Request("https://x/", { headers: h }));
    expect(key({ "x-real-ip": "203.0.113.7" })).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/);
    expect(key({ "x-real-ip": "203.0.113.7" })).toBe(key({ "x-forwarded-for": "203.0.113.7, 10.0.0.1" }));
    expect(key({ "x-real-ip": "203.0.113.7" })).not.toBe(key({ "x-real-ip": "203.0.113.8" }));
    expect(key({ "x-real-ip": "203.0.113.7" })).not.toContain("203");
  });
});
