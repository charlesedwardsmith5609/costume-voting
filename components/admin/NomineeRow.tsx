import Link from "next/link";
import { Photo } from "@/components/Photo";
import type { AdminNominee } from "@/lib/adminApi";
import { categoryLabel } from "@/lib/categories";
import { singleLine } from "@/lib/nomineeLabel";

const SMALL = "inline-flex min-h-11 items-center justify-center rounded-xl px-4 font-bold disabled:opacity-50";

// One nominee in the moderation list: tap the photo or label for details; Hide/Unhide and Delete.
export function NomineeRow({
  nominee,
  busy,
  onHide,
  onDelete,
}: {
  nominee: AdminNominee;
  busy: boolean;
  onHide: () => void;
  onDelete: () => void;
}) {
  const label = singleLine(nominee);
  return (
    <li className={`flex items-center gap-3 rounded-xl px-3 py-2 ${nominee.hidden ? "bg-white/[.03] opacity-60" : "bg-white/5"}`}>
      <Link href={`/admin/nominees/${nominee.id}`} className="flex min-w-0 flex-1 items-center gap-3">
        <div className="w-14 shrink-0 overflow-hidden rounded-lg">
          <Photo thumbUrl={nominee.thumbUrl} photoUrl={nominee.photoUrl} alt={label} />
        </div>
        <div className="min-w-0">
          <p className="truncate text-lg font-semibold">
            {nominee.hidden && <span className="mr-2 rounded bg-zinc-700 px-1.5 py-0.5 text-sm text-zinc-200">Hidden</span>}
            {label}
          </p>
          <p className="truncate text-sm text-violet-200">{nominee.categories.map(categoryLabel).join(" · ")}</p>
        </div>
      </Link>
      <div className="flex shrink-0 flex-col gap-2 sm:flex-row">
        <button type="button" disabled={busy} onClick={onHide} className={`${SMALL} bg-witch/25 ring-1 ring-witch/60`}>
          {nominee.hidden ? "Unhide" : "Hide"}
        </button>
        <button type="button" disabled={busy} onClick={onDelete} className={`${SMALL} bg-red-950 text-red-200 ring-1 ring-red-400/50`}>
          Delete
        </button>
      </div>
    </li>
  );
}
