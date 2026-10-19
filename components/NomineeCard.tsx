import Link from "next/link";
import { labelLines, singleLine } from "@/lib/nomineeLabel";
import type { GuestNominee } from "@/lib/types";
import { Photo } from "./Photo";
import { LINK } from "./ui";

type Props = {
  nominee: GuestNominee;
  selected: boolean;
  voted: boolean;
  onSelect: (() => void) | null;
  // Shown while voting is open: "Edit", plus "Add their name" on a mystery guest.
  editHref: string | null;
};

export function NomineeCard({ nominee, selected, voted, onSelect, editHref }: Props) {
  const { top, bottom, mystery } = labelLines(nominee);
  return (
    <li className="flex flex-col">
      <button
        type="button"
        onClick={onSelect ?? undefined}
        aria-pressed={onSelect ? selected : undefined}
        className={`block w-full overflow-hidden rounded-2xl bg-white/5 text-left ring-4 transition ${
          selected ? "ring-pumpkin" : voted ? "ring-witch" : "ring-transparent"
        }`}
      >
        <div className="relative">
          <Photo thumbUrl={nominee.thumbUrl} photoUrl={nominee.photoUrl} alt={singleLine(nominee)} />
          {voted && (
            <span className="absolute right-2 top-2 rounded-full bg-witch px-2.5 py-1 text-base font-bold text-white">
              ✓
            </span>
          )}
        </div>
        {/* One line per name, always two lines, so every card in a row is the same height. */}
        <div className="px-3 py-2">
          <p className="truncate font-semibold leading-tight">{top}</p>
          <p className="truncate text-sm leading-tight text-violet-200">{bottom ?? "\u00a0"}</p>
        </div>
      </button>
      {editHref && (
        <div className="flex flex-col px-1">
          {mystery && (
            <Link href={editHref} className={`${LINK} text-sm`}>
              Know who this is? Add their name
            </Link>
          )}
          <Link href={editHref} className={`${LINK} text-sm`}>
            Edit
          </Link>
        </div>
      )}
    </li>
  );
}
