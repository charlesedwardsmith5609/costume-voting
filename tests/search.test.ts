import { describe, expect, it } from "vitest";
import { filterByName, SEARCH_THRESHOLD, showSearch } from "@/lib/search";

const n = (personName: string | null, costumeName: string | null) => ({ personName, costumeName });
const list = [n("Sam", "The Mad Hatter"), n("Ana", null), n(null, "Witch"), n(null, null)];

describe("category search", () => {
  it("appears once a category has more than 8 nominees", () => {
    expect(SEARCH_THRESHOLD).toBe(8);
    expect(showSearch(8)).toBe(false);
    expect(showSearch(9)).toBe(true);
  });

  it("matches either name, case-insensitive substring", () => {
    expect(filterByName(list, "HAT")).toEqual([list[0]]);
    expect(filterByName(list, " an ")).toEqual([list[1]]);
    expect(filterByName(list, "wit")).toEqual([list[2]]);
  });

  it("never matches photo-only nominees, and an empty query shows everyone", () => {
    expect(filterByName(list, "mystery")).toEqual([]);
    expect(filterByName(list, "  ")).toEqual(list);
  });
});
