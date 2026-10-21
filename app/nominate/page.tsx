"use client";
import Link from "next/link";
import { useCallback, useState } from "react";
import { BackLink } from "@/components/BackLink";
import { Photo } from "@/components/Photo";
import { StatusBanner } from "@/components/StatusBanner";
import { INPUT, PAGE, SECONDARY } from "@/components/ui";
import { fetchAllNominees } from "@/lib/api";
import { categoryLabel } from "@/lib/categories";
import { canWrite } from "@/lib/clock";
import { GENERIC_ERROR } from "@/lib/guestErrors";
import { useGuestState, useOnVisible } from "@/lib/hooks";
import { labelLines, singleLine } from "@/lib/nomineeLabel";
import { filterByName } from "@/lib/search";
import type { GuestNominee } from "@/lib/types";

// "Nominate a costume", step 1: pick someone already nominated (to add more categories) or
// add someone new. Lists every non-hidden nominee, newest first.
export default function NominatePage() {
  const { view, failed: stateFailed, refresh } = useGuestState();
  const open = canWrite(view);
  const [nominees, setNominees] = useState<GuestNominee[] | null>(null);
  const [loadFailed, setLoadFailed] = useState(false);
  const [query, setQuery] = useState("");

  const load = useCallback(() => {
    fetchAllNominees()
      .then((list) => {
        setNominees(list);
        setLoadFailed(false);
      })
      .catch(() => setLoadFailed(true));
  }, []);
  useOnVisible(load);

  const shown = nominees && filterByName(nominees, query);

  return (
    <main className={PAGE}>
      <StatusBanner view={view} failed={stateFailed} onRetry={refresh} />
      <BackLink href="/">← All categories</BackLink>
      <h1 className="mb-4 mt-2 font-title text-4xl text-pumpkin">Is this person already here?</h1>
      {open && (
        <>
          <Link href="/nominate/new" className={`${SECONDARY} mb-4 w-full`}>
            Not here? Add someone new
          </Link>
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search by name"
            aria-label="Search by name"
            className={`${INPUT} mb-4`}
          />
          {loadFailed && !nominees && <p className="text-lg">{GENERIC_ERROR}</p>}
          {!nominees && !loadFailed && <p className="text-lg">Loading…</p>}
          {nominees?.length === 0 && <p className="py-8 text-center text-xl">No nominees yet. Be the first!</p>}
          {nominees && nominees.length > 0 && shown?.length === 0 && (
            <p className="py-8 text-center text-xl">No one by that name yet.</p>
          )}
          {shown && shown.length > 0 && (
            <ul className="grid grid-cols-2 gap-x-3 gap-y-4">
              {shown.map((n) => (
                <PickCard key={n.id} nominee={n} />
              ))}
            </ul>
          )}
        </>
      )}
    </main>
  );
}

// Fixed-height text (one line per name, two for categories) so every card in a row matches;
// the full label is the photo's alt text.
function PickCard({ nominee }: { nominee: GuestNominee }) {
  const { top, bottom } = labelLines(nominee);
  return (
    <li>
      <Link
        href={`/nominate/${nominee.id}`}
        className="block h-full overflow-hidden rounded-2xl bg-white/5 ring-1 ring-white/10 active:ring-pumpkin"
      >
        <Photo thumbUrl={nominee.thumbUrl} photoUrl={nominee.photoUrl} alt={singleLine(nominee)} />
        <div className="px-3 py-2">
          <p className="truncate font-semibold leading-tight">{top}</p>
          <p className="truncate text-sm leading-tight text-violet-200">{bottom ?? "\u00a0"}</p>
          <p className="mt-1 line-clamp-2 min-h-[2lh] text-xs leading-tight text-violet-300">
            {nominee.categories.map(categoryLabel).join(" · ")}
          </p>
        </div>
      </Link>
    </li>
  );
}
