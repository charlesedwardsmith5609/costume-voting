import { describe, expect, it } from "vitest";
import { winnersOf } from "@/lib/reveal";
import { firstAudibleSeconds } from "@/lib/revealSound";

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

describe("firstAudibleSeconds", () => {
  it("skips leading silence, with a small lead-in", () => {
    const data = new Float32Array(1000);
    data[500] = 0.5;
    expect(firstAudibleSeconds(data, 1000)).toBeCloseTo(0.49);
  });

  it("is 0 when the sound starts at once or never", () => {
    expect(firstAudibleSeconds(Float32Array.of(0.5, 0), 1000)).toBe(0);
    expect(firstAudibleSeconds(new Float32Array(100), 1000)).toBe(0);
  });
});
