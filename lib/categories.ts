// Fixed category list, in display order. Slugs match the nominees.category check constraint.
export const CATEGORIES = [
  { slug: "most_elaborate", label: "Most Elaborate" },
  { slug: "most_unique", label: "Most Unique" },
  { slug: "funniest", label: "Funniest" },
  { slug: "best_couples", label: "Best Couples Costume" },
] as const;

export type CategorySlug = (typeof CATEGORIES)[number]["slug"];

export function isCategory(value: unknown): value is CategorySlug {
  return CATEGORIES.some((c) => c.slug === value);
}

export function categoryLabel(slug: CategorySlug): string {
  return CATEGORIES.find((c) => c.slug === slug)!.label;
}
