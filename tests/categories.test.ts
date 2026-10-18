import { describe, expect, it } from "vitest";
import { CATEGORIES, categoryLabel, isCategory } from "@/lib/categories";

describe("categories", () => {
  it("lists the four categories in spec order", () => {
    expect(CATEGORIES.map((c) => c.label)).toEqual([
      "Most Elaborate",
      "Most Unique",
      "Funniest",
      "Best Couples Costume",
    ]);
  });

  it("validates slugs", () => {
    expect(isCategory("funniest")).toBe(true);
    expect(isCategory("scariest")).toBe(false);
    expect(isCategory(undefined)).toBe(false);
  });

  it("maps slugs to labels", () => {
    expect(categoryLabel("best_couples")).toBe("Best Couples Costume");
  });
});
