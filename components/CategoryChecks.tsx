import { CATEGORIES, type CategorySlug } from "@/lib/categories";

// Category checkboxes. Locked categories show checked and cannot be unchecked (a guest cannot
// remove a nominee from a category).
export function CategoryChecks({
  checked,
  locked = [],
  disabled,
  onChange,
}: {
  checked: CategorySlug[];
  locked?: CategorySlug[];
  disabled: boolean;
  onChange: (next: CategorySlug[]) => void;
}) {
  return (
    <fieldset className="space-y-2" disabled={disabled}>
      {CATEGORIES.map(({ slug, label }) => {
        const isLocked = locked.includes(slug);
        const on = isLocked || checked.includes(slug);
        return (
          <label
            key={slug}
            className={`flex min-h-12 items-center gap-3 rounded-xl bg-white/5 px-4 text-lg ring-1 ring-white/10 ${isLocked ? "opacity-70" : ""}`}
          >
            <input
              type="checkbox"
              className="size-6 accent-pumpkin"
              checked={on}
              disabled={isLocked}
              onChange={(e) => onChange(e.target.checked ? [...checked, slug] : checked.filter((c) => c !== slug))}
            />
            {label}
          </label>
        );
      })}
    </fieldset>
  );
}
