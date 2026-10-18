import { describe, expect, it } from "vitest";
import { buildNomineeLists, type NomineeRow, STRIP_SIZE } from "@/lib/server/nominees";

let seq = 0;
// Each row is newer than the last; `cats` maps category to added_at order.
function row(person: string | null, costume: string | null, cats: string[]): NomineeRow {
  seq += 1;
  const t = new Date(Date.UTC(2026, 9, 24, 20, 0, seq)).toISOString();
  return {
    id: `00000000-0000-4000-8000-${String(seq).padStart(12, "0")}`,
    person_name: person,
    costume_name: costume,
    photo_path: `dev/${seq}.jpg`,
    created_at: t,
    nominee_categories: cats.map((category) => ({ category, added_at: t })) as NomineeRow["nominee_categories"],
  };
}
const build = (rows: NomineeRow[], q: string[] = []) => buildNomineeLists(rows, "funniest", q, (p) => `https://cdn/${p}`);
const names = (l: { personName: string | null }[]) => l.map((n) => n.personName);

describe("buildNomineeLists", () => {
  it("lists only this category, newest added first, with guest fields only", () => {
    const rows = [row("A", null, ["funniest"]), row("B", null, ["most_unique"]), row("C", null, ["funniest", "best_couples"])];
    const lists = build(rows);
    expect(names(lists.nominees)).toEqual(["C", "A"]);
    expect(lists.nominees[0]).toEqual({
      id: rows[2].id,
      personName: "C",
      costumeName: null,
      categories: ["funniest", "best_couples"],
      photoUrl: `https://cdn/${rows[2].photo_path}`,
    });
    expect(lists.matches).toBeUndefined();
  });

  it("orders by when the nominee was added to this category, not when it was created", () => {
    const old = row("Old", null, ["most_unique"]);
    const mid = row("Mid", null, ["funniest"]);
    old.nominee_categories.push({ category: "funniest", added_at: new Date(Date.UTC(2026, 9, 25)).toISOString() });
    expect(names(build([old, mid]).nominees)).toEqual(["Old", "Mid"]);
  });

  it("caps both strips at the newest 12, and the elsewhere strip excludes this category", () => {
    const here = Array.from({ length: STRIP_SIZE + 1 }, (_, i) => row(`H${i}`, null, ["funniest"]));
    const away = Array.from({ length: STRIP_SIZE + 1 }, (_, i) => row(`E${i}`, null, ["most_unique"]));
    const { strips, nominees } = build([...here, ...away]);
    expect(nominees).toHaveLength(STRIP_SIZE + 1);
    expect(strips.here).toHaveLength(STRIP_SIZE);
    expect(strips.here[0].personName).toBe(`H${STRIP_SIZE}`);
    expect(names(strips.here)).not.toContain("H0");
    expect(strips.elsewhere).toHaveLength(STRIP_SIZE);
    expect(names(strips.elsewhere).every((n) => n!.startsWith("E"))).toBe(true);
    expect(names(strips.elsewhere)).not.toContain("E0");
  });

  it("matches either name, case-insensitively, split by category; photo-only never matches", () => {
    const rows = [
      row("Sam", "The Mad Hatter", ["funniest"]),
      row(null, "Mad Max", ["most_unique"]),
      row(null, null, ["funniest"]),
      row("Pat", null, ["most_unique"]),
    ];
    const { matches } = build(rows, ["  mad "]);
    expect(matches!.here.map((n) => n.costumeName)).toEqual(["The Mad Hatter"]);
    expect(matches!.elsewhere.map((n) => n.costumeName)).toEqual(["Mad Max"]);
    expect(build(rows, ["sam", "pat"]).matches!.elsewhere.map((n) => n.personName)).toEqual(["Pat"]);
  });

  it("ignores queries shorter than two characters", () => {
    expect(build([row("Sam", null, ["funniest"])], ["s", " "]).matches).toBeUndefined();
  });
});
