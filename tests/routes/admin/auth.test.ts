import "../env";
import { readdirSync } from "node:fs";
import { join, relative } from "node:path";
import { beforeEach, describe, expect, it } from "vitest";
import { POST as login } from "@/app/api/admin/login/route";
import { POST as logout } from "@/app/api/admin/logout/route";
import { GET as session } from "@/app/api/admin/session/route";
import { countRows, fillRateLimit, getSettings, resetDb, seedNominee } from "../../db/helpers";
import { call, get, post } from "../request";
import { loginKey, sessionValue } from "@/lib/server/admin";

const ADMIN_DIR = join(process.cwd(), "app/api/admin");
const METHODS = ["GET", "POST", "PUT", "PATCH", "DELETE"] as const;
// The only admin route that must work without a session.
const PUBLIC = new Set(["login"]);

// Every exported handler under app/api/admin, found on disk so a new route cannot be missed.
async function adminHandlers() {
  const files = readdirSync(ADMIN_DIR, { recursive: true, encoding: "utf8" }).filter((f) => f.endsWith("route.ts"));
  const handlers: Array<[string, string, (req: Request) => Promise<Response>]> = [];
  for (const file of files) {
    const route = relative(ADMIN_DIR, join(ADMIN_DIR, file)).replace(/\/?route\.ts$/, "");
    const mod = await import(join(ADMIN_DIR, file));
    for (const m of METHODS) if (typeof mod[m] === "function") handlers.push([route, m, mod[m]]);
  }
  return handlers;
}

const BAD_COOKIES: Array<[string, () => string | undefined]> = [
  ["no cookie", () => undefined],
  ["a garbage cookie", () => "admin_session=garbage"],
  ["an expired cookie", () => `admin_session=${sessionValue(Date.now() - 1000)}`],
  [
    "a tampered expiry",
    () => {
      const [v, exp, sig] = sessionValue(Date.now() + 3600_000).split(".");
      return `admin_session=${v}.${Number(exp) + 1}.${sig}`;
    },
  ],
  [
    "a cookie signed with another secret",
    () => {
      const real = process.env.SESSION_SECRET!;
      process.env.SESSION_SECRET = "a-different-secret-0123456789abcdefghij";
      const forged = sessionValue(Date.now() + 3600_000);
      process.env.SESSION_SECRET = real;
      return `admin_session=${forged}`;
    },
  ],
];

beforeEach(resetDb);

describe("every admin route requires the session cookie", () => {
  it("finds the admin routes", async () => {
    const routes = new Set((await adminHandlers()).map(([r]) => r));
    expect(routes.size).toBeGreaterThanOrEqual(16);
    for (const r of ["timer", "results", "reset", "merge", "export"]) expect(routes).toContain(r);
  });

  it.each(BAD_COOKIES)("returns 401 with %s and changes nothing", async (_label, cookie) => {
    await seedNominee(["funniest"]);
    for (const [route, method, handler] of await adminHandlers()) {
      if (PUBLIC.has(route)) continue;
      const path = `/api/admin/${route}?nomineeId=00000000-0000-4000-8000-000000000000`;
      const body = { confirm: "RESET", action: "start", minutes: 30 };
      const req = method === "GET" ? get(path, { cookie: cookie() }) : post(path, { cookie: cookie(), body });
      const { status, body: res } = await call(handler(req));
      expect(status, `${method} ${route}`).toBe(401);
      expect(res.error, `${method} ${route}`).toBe("unauthorized");
    }
    // The timer start and the reset in the bodies above never ran.
    expect(await getSettings()).toEqual({ voting_opens_at: null, voting_closes_at: null });
    expect(await countRows("nominees")).toBe(1);
  });
});

describe("POST /api/admin/login", () => {
  const attempt = (password: unknown, ip = "198.51.100.1") =>
    login(post("/api/admin/login", { body: { password }, ip }));

  it("rejects a wrong or missing password with 401 and no cookie", async () => {
    for (const pw of ["wrong", "", undefined, 123]) {
      const res = await attempt(pw);
      expect(res.status).toBe(401);
      expect(res.headers.get("set-cookie")).toBeNull();
    }
  });

  it("sets a session cookie that the other admin routes accept, and logout clears it", async () => {
    const res = await attempt("test-admin-password");
    expect(res.status).toBe(200);
    const setCookie = res.headers.get("set-cookie")!;
    expect(setCookie).toMatch(/^admin_session=v1\.\d+\.[\w-]{43}; Max-Age=43200; Path=\/; HttpOnly; SameSite=Strict$/);
    const cookie = setCookie.split(";")[0];
    expect((await call(session(get("/api/admin/session", { cookie })))).status).toBe(200);

    const out = await logout(post("/api/admin/logout", { cookie }));
    expect(out.status).toBe(200);
    expect(out.headers.get("set-cookie")).toMatch(/^admin_session=; Max-Age=0;/);
  });

  it("limits each IP to 10 attempts per 10 minutes, right password included", async () => {
    const ip = "198.51.100.77";
    await fillRateLimit(loginKey(new Request("http://x", { headers: { "x-real-ip": ip } })), "login", 9);
    expect((await attempt("wrong", ip)).status).toBe(401);
    const blocked = await call(attempt("test-admin-password", ip));
    expect(blocked).toMatchObject({ status: 429, body: { error: "rate_limited" } });
    // Another IP is unaffected.
    expect((await attempt("test-admin-password", "198.51.100.78")).status).toBe(200);
  });
});
