import { describe, expect, it } from "vitest";
import { buildGuestResults, buildResults, CSV_HEADER, type ResultNomineeRow, toCsv, type VoteRow } from "@/lib/server/results";

let seq = 0;
function nominee(person: string | null, cats: string[], hidden = false, costume: string | null = null): ResultNomineeRow {
  seq += 1;
  return {
    id: `00000000-0000-4000-8000-${String(seq).padStart(12, "0")}`,
    person_name: person,
    costume_name: costume,
    photo_path: `guest/${seq}.jpg`,
    hidden,
    nominee_categories: cats.map((category) => ({ category })) as ResultNomineeRow["nominee_categories"],
  };
}
const votes = (n: ResultNomineeRow, category: string, count: number, prefix = n.id.slice(-4)): VoteRow[] =>
  Array.from({ length: count }, (_, i) => ({ device_id: `${prefix}-${i}`, category, nominee_id: n.id }) as VoteRow);

describe("buildResults", () => {
  it("ranks densely (1, 1, 2), ties by label, zero-vote nominees ranked last", () => {
    const [a, b, c, d] = [nominee("Bo", ["funniest"]), nominee("Al", ["funniest"]), nominee("Cy", ["funniest"]), nominee("Di", ["funniest"])];
    const r = buildResults([a, b, c, d], [...votes(a, "funniest", 3), ...votes(b, "funniest", 3), ...votes(c, "funniest", 1)]);
    const funniest = r.categories.find((x) => x.category === "funniest")!;
    expect(funniest.nominees.map((n) => [n.label, n.votes, n.rank])).toEqual([
      ["Al", 3, 1],
      ["Bo", 3, 1],
      ["Cy", 1, 2],
      ["Di", 0, 3],
    ]);
    expect(funniest.totalVotes).toBe(7);
  });

  it("lists every category in order, including empty ones", () => {
    const r = buildResults([], []);
    expect(r.categories.map((c) => c.category)).toEqual(["most_elaborate", "most_unique", "funniest", "best_couples"]);
    expect(r.categories.every((c) => c.totalVotes === 0 && c.nominees.length === 0)).toBe(true);
    expect(r.distinctDevices).toBe(0);
  });

  it("puts hidden nominees last with a null rank and their stored votes, outside the totals", () => {
    const shown = nominee("Al", ["funniest"]);
    const hidden = nominee("Zed", ["funniest"], true);
    const r = buildResults([hidden, shown], [...votes(shown, "funniest", 1), ...votes(hidden, "funniest", 5)]);
    const funniest = r.categories.find((x) => x.category === "funniest")!;
    expect(funniest.nominees.map((n) => [n.label, n.votes, n.rank, n.hidden])).toEqual([
      ["Al", 1, 1, false],
      ["Zed", 5, null, true],
    ]);
    expect(funniest.totalVotes).toBe(1);
    expect(r.distinctDevices).toBe(1);
  });

  it("counts each device once across categories", () => {
    const n = nominee("Al", ["funniest", "most_unique"]);
    const r = buildResults([n], [...votes(n, "funniest", 2, "dev"), ...votes(n, "most_unique", 3, "dev")]);
    expect(r.distinctDevices).toBe(3);
  });
});

describe("toCsv", () => {
  const url = (p: string) => `https://cdn.example/${p}`;

  it("writes a BOM, the header, and one CRLF row per nominee per category", () => {
    const n = nominee("Sam", ["funniest", "best_couples"], false, "The Mad Hatter");
    const csv = toCsv(buildResults([n], votes(n, "funniest", 2)), url);
    expect(csv.startsWith("\uFEFF")).toBe(true);
    const lines = csv.slice(1).split("\r\n");
    expect(lines[0]).toBe(CSV_HEADER.join(","));
    expect(lines.slice(1, -1)).toEqual([
      `Funniest,1,Sam as The Mad Hatter,Sam,The Mad Hatter,2,false,https://cdn.example/${n.photo_path}`,
      `Best Couples Costume,1,Sam as The Mad Hatter,Sam,The Mad Hatter,0,false,https://cdn.example/${n.photo_path}`,
    ]);
    expect(lines.at(-1)).toBe("");
  });

  it("leaves rank empty for hidden nominees and shows mystery guests by label", () => {
    const n = nominee(null, ["funniest"], true);
    const row = toCsv(buildResults([n], votes(n, "funniest", 4)), url).split("\r\n")[1];
    expect(row).toBe(`Funniest,,Mystery guest 👻,,,4,true,https://cdn.example/${n.photo_path}`);
  });

  it("quotes commas, quotes, and newlines, and defuses formulas in guest-typed text", () => {
    const n = nominee('Sam "The Man", Jr.', ["funniest"], false, "=HYPERLINK(\"x\")");
    const row = toCsv(buildResults([n], []), url).split("\r\n")[1];
    expect(row).toBe(
      'Funniest,1,"Sam ""The Man"", Jr. as =HYPERLINK(""x"")","Sam ""The Man"", Jr.","\'=HYPERLINK(""x"")",0,false,' +
        `https://cdn.example/${n.photo_path}`,
    );
    for (const lead of ["+", "-", "@"]) {
      const m = nominee(`${lead}1`, ["funniest"]);
      expect(toCsv(buildResults([m], []), url).split("\r\n")[1]).toContain(`,'${lead}1,'${lead}1,`);
    }
  });
});

describe("buildGuestResults", () => {
  it("ranks nominees with votes, lists zero-vote ones by label, drops hidden ones and every count", () => {
    const [a, b, c, d, h] = [
      nominee("Bo", ["funniest"]),
      nominee("Al", ["funniest"]),
      nominee("Zed", ["funniest"]),
      nominee(null, ["funniest"], false, "Alien"),
      nominee("Hal", ["funniest"], true),
    ];
    const r = buildResults([a, b, c, d, h], [...votes(a, "funniest", 2), ...votes(b, "funniest", 2), ...votes(h, "funniest", 5)]);
    const funniest = buildGuestResults(r, (p) => `https://cdn/${p}`).categories.find((x) => x.category === "funniest")!;
    expect(funniest.ranked.map((n) => [n.personName, n.rank])).toEqual([
      ["Al", 1],
      ["Bo", 1],
    ]);
    expect(funniest.alsoNominated.map((n) => n.costumeName ?? n.personName)).toEqual(["Alien", "Zed"]);
    expect(funniest.ranked[0].thumbUrl).toBe(`https://cdn/${b.photo_path.replace(/\.jpg$/, ".thumb.jpg")}`);
    expect(JSON.stringify(funniest)).not.toMatch(/votes|Hal/);
  });
});
