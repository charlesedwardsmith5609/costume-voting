import { describe, expect, it } from "vitest";
import { winnersOf } from "@/lib/reveal";

const n = (id: string, rank: number, votes: number) => ({ id, rank, votes });

describe("winnersOf", () => {
  it("returns the single winner", () => {
    expect(winnersOf([n("a", 1, 5), n("b", 2, 3)]).map((x) => x.id)).toEqual(["a"]);
  });

  it("returns every tied first place", () => {
    expect(winnersOf([n("a", 1, 4), n("b", 1, 4), n("c", 2, 1)]).map((x) => x.id)).toEqual(["a", "b"]);
  });

  it("has no winner when nobody got a vote", () => {
    expect(winnersOf([n("a", 1, 0), n("b", 1, 0)])).toEqual([]);
    expect(winnersOf([])).toEqual([]);
  });
});
