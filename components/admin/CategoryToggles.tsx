"use client";
import { CATEGORIES, type CategorySlug } from "@/lib/categories";

// Host category toggles; each change saves on its own. Removing asks first, because it deletes
// the nominee's votes in that category. The last category can't be removed.
export function CategoryToggles({
  categories,
  disabled,
  onToggle,
}: {
  categories: CategorySlug[];
  disabled: boolean;
  onToggle: (category: CategorySlug, present: boolean) => void;
}) {
  const last = categories.length === 1;
  return (
    <fieldset className="space-y-2" disabled={disabled}>
      {CATEGORIES.map(({ slug, label }) => {
        const on = categories.includes(slug);
        const locked = on && last;
        return (
          <label
            key={slug}
            className={`flex min-h-12 items-center gap-3 rounded-xl bg-white/5 px-4 text-lg ring-1 ring-white/10 ${locked ? "opacity-70" : ""}`}
          >
            <input
              type="checkbox"
              className="size-6 accent-pumpkin"
              checked={on}
              disabled={locked}
              onChange={(e) => {
                const present = e.target.checked;
                if (!present && !window.confirm(`Remove from ${label}? Their votes in this category are deleted.`)) return;
                onToggle(slug, present);
              }}
            />
            {label}
          </label>
        );
      })}
      {last && <p className="text-violet-200">A nominee needs at least one category. To take it off the ballot, hide or delete it.</p>}
    </fieldset>
  );
}
