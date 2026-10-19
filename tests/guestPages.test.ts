// Guest pages run in the browser: they must never call admin routes (which carry vote counts)
// or import server modules (which hold the service role key). SPEC acceptance 8.
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const ROOT = join(__dirname, "..");
const files = (dir: string) =>
  readdirSync(join(ROOT, dir), { recursive: true, encoding: "utf8" })
    .filter((f) => /\.tsx?$/.test(f))
    .map((f) => join(dir, f));

const CLIENT = [
  "app/page.tsx",
  "app/help/page.tsx",
  ...files("app/c"),
  ...files("app/nominate"),
  ...files("components"),
  ...readdirSync(join(ROOT, "lib")).filter((f) => /\.tsx?$/.test(f)).map((f) => `lib/${f}`),
];

describe("guest pages", () => {
  it("found the guest page, component, and client library files", () => {
    expect(CLIENT).toEqual(expect.arrayContaining(["app/page.tsx", "app/c/[category]/page.tsx", "app/nominate/[id]/page.tsx", "lib/api.ts", "components/NomineeCard.tsx"]));
  });

  it.each(CLIENT)("%s never calls an admin route or imports server code", (file) => {
    const text = readFileSync(join(ROOT, file), "utf8");
    expect(text).not.toMatch(/\/api\/admin/);
    expect(text).not.toMatch(/lib\/server|["']\.\/server/);
  });
});
