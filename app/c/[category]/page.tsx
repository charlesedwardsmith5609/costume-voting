"use client";
import Link from "next/link";
import { notFound, useParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { BackLink } from "@/components/BackLink";
import { NomineeCard } from "@/components/NomineeCard";
import { StatusBanner } from "@/components/StatusBanner";
import { INPUT, PAGE, PRIMARY } from "@/components/ui";
import { ApiError, castVote, fetchMyVotes, fetchNominees } from "@/lib/api";
import { canWrite } from "@/lib/clock";
import { categoryLabel, isCategory, type CategorySlug } from "@/lib/categories";
import { errorMessage, GENERIC_ERROR } from "@/lib/guestErrors";
import { useGuestState, useOnVisible } from "@/lib/hooks";
import { singleLine } from "@/lib/nomineeLabel";
import { filterByName, showSearch } from "@/lib/search";
import type { GuestNominee } from "@/lib/types";

export default function CategoryPage() {
  const { category } = useParams<{ category: string }>();
  if (!isCategory(category)) notFound();
  return <CategoryScreen category={category} />;
}

// Category screen: nominee grid, tap to select, then Vote. Voting again changes the vote.
function CategoryScreen({ category }: { category: CategorySlug }) {
  const { view, failed: stateFailed, refresh } = useGuestState();
  const open = canWrite(view);
  const [nominees, setNominees] = useState<GuestNominee[] | null>(null);
  const [loadFailed, setLoadFailed] = useState(false);
  const [myVote, setMyVote] = useState<string | undefined>();
  const [selected, setSelected] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<{ text: string; error: boolean } | null>(null);

  const load = useCallback(() => {
    Promise.all([fetchNominees(category), fetchMyVotes()])
      .then(([lists, votes]) => {
        setNominees(lists.nominees);
        setMyVote(votes[category]);
        setLoadFailed(false);
      })
      .catch(() => setLoadFailed(true));
  }, [category]);
  useOnVisible(load);

  useEffect(() => {
    if (!notice || notice.error) return;
    const timer = setTimeout(() => setNotice(null), 2500);
    return () => clearTimeout(timer);
  }, [notice]);

  async function vote() {
    if (!selected) return;
    setBusy(true);
    setNotice(null);
    try {
      await castVote(category, selected);
      setMyVote(selected);
      setSelected(null);
      setNotice({ text: "Vote saved!", error: false });
    } catch (err) {
      const code = err instanceof ApiError ? err.code : "server_error";
      if (code === "closed") refresh();
      if (code === "not_found" || code === "invalid_nominee") {
        setSelected(null);
        load();
      }
      setNotice({ text: errorMessage(code, view.kind === "opens_soon"), error: true });
    } finally {
      setBusy(false);
    }
  }

  const voted = nominees?.find((n) => n.id === myVote);
  const shown = nominees && showSearch(nominees.length) ? filterByName(nominees, query) : nominees;
  const showVoteBar = open && selected !== null && selected !== myVote;

  return (
    <main className={PAGE}>
      <StatusBanner view={view} failed={stateFailed} onRetry={refresh} />
      <BackLink href="/">← All categories</BackLink>
      <h1 className="mb-4 mt-2 font-title text-4xl text-pumpkin">{categoryLabel(category)}</h1>
      {voted && (
        <p className="mb-4 text-lg">
          Your vote: <span className="font-bold text-pumpkin">{singleLine(voted)}</span>
        </p>
      )}
      {nominees && showSearch(nominees.length) && (
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search by name"
          aria-label="Search by name"
          className={`${INPUT} mb-4`}
        />
      )}
      {loadFailed && !nominees && <p className="text-lg">{GENERIC_ERROR}</p>}
      {!nominees && !loadFailed && <p className="text-lg">Loading…</p>}
      {nominees?.length === 0 && <p className="py-8 text-center text-xl">No nominees yet. Be the first!</p>}
      {shown && shown.length > 0 && (
        <ul className="grid grid-cols-2 gap-x-3 gap-y-4">
          {shown.map((n) => (
            <NomineeCard
              key={n.id}
              nominee={n}
              selected={n.id === selected}
              voted={n.id === myVote}
              onSelect={open ? () => setSelected(n.id === selected ? null : n.id) : null}
              editHref={open ? `/c/${category}/edit/${n.id}` : null}
            />
          ))}
        </ul>
      )}
      {open && (
        <Link href={`/c/${category}/add`} className={`${PRIMARY} mt-6 w-full`}>
          + Add a nominee
        </Link>
      )}
      {(showVoteBar || notice) && (
        <div className="fixed inset-x-0 bottom-0 border-t border-white/10 bg-night/95 px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-3">
          <div className="mx-auto max-w-md space-y-2">
            {notice && (
              <p role="status" className={`text-center text-lg font-semibold ${notice.error ? "text-red-300" : "text-pumpkin"}`}>
                {notice.text}
              </p>
            )}
            {showVoteBar && (
              <button type="button" onClick={vote} disabled={busy} className={`${PRIMARY} w-full`}>
                Vote
              </button>
            )}
          </div>
        </div>
      )}
    </main>
  );
}
