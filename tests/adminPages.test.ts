// Admin pages run in the browser: they must never import server modules (which hold the service
// role key and session secret). Every admin route checks the session on the server.
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const ROOT = join(__dirname, "..");
const files = (dir: string) =>
  readdirSync(join(ROOT, dir), { recursive: true, encoding: "utf8" })
    .filter((f) => /\.tsx?$/.test(f))
    .map((f) => join(dir, f));

const ADMIN = [...files("app/admin"), ...files("components/admin"), "lib/adminApi.ts"];

describe("admin pages", () => {
  it("found the admin page, component, and client files", () => {
    expect(ADMIN).toEqual(expect.arrayContaining(["app/admin/layout.tsx", "components/admin/LoginForm.tsx", "lib/adminApi.ts"]));
  });

  it.each(ADMIN)("%s never imports server code", (file) => {
    expect(readFileSync(join(ROOT, file), "utf8")).not.toMatch(/lib\/server|["']\.\/server/);
  });
});
