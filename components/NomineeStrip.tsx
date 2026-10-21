import { labelLines } from "@/lib/nomineeLabel";
import type { GuestNominee } from "@/lib/types";
import { Photo } from "./Photo";

// A horizontal strip of small nominee cards for "Already nominated?". action, when given, adds
// a button under each card.
export function NomineeStrip({
  title,
  nominees,
  action,
}: {
  title?: string;
  nominees: GuestNominee[];
  action?: { label: (n: GuestNominee) => string; onClick: (n: GuestNominee) => void; disabled: boolean };
}) {
  if (nominees.length === 0) return null;
  return (
    <section className="space-y-2">
      {title && <h3 className="text-base font-semibold text-violet-200">{title}</h3>}
      <ul className="-mx-4 flex snap-x gap-3 overflow-x-auto px-4 pb-2">
        {nominees.map((n) => {
          const { top, bottom } = labelLines(n);
          return (
            <li key={n.id} className="w-32 shrink-0 snap-start overflow-hidden rounded-xl bg-white/5">
              <Photo thumbUrl={n.thumbUrl} photoUrl={n.photoUrl} alt={top} />
              <div className="px-2 py-1.5">
                <p className="truncate text-sm font-semibold">{top}</p>
                {bottom && <p className="truncate text-xs text-violet-200">{bottom}</p>}
              </div>
              {action && (
                <button
                  type="button"
                  disabled={action.disabled}
                  onClick={() => action.onClick(n)}
                  className="min-h-11 w-full bg-pumpkin/90 px-2 py-1 text-sm font-bold leading-tight text-night disabled:opacity-50"
                >
                  {action.label(n)}
                </button>
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}
