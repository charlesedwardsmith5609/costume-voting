"use client";
import { useEffect, useState } from "react";
import { BackLink } from "@/components/BackLink";
import { Photo } from "@/components/Photo";
import { StatusBanner } from "@/components/StatusBanner";
import { PAGE, SECONDARY } from "@/components/ui";
import { ApiError, fetchResults } from "@/lib/api";
import { GENERIC_ERROR } from "@/lib/guestErrors";
import { useGuestState } from "@/lib/hooks";
import { labelLines, singleLine } from "@/lib/nomineeLabel";
import type { GuestCategoryResult } from "@/lib/types";

// Published results: the winner of each category (every tied winner), with a button per category
// for the full rankings. Rank order only; guests never see vote counts.
export default function ResultsPage() {
  const { view, failed: stateFailed, refresh } = useGuestState();
  const [results, setResults] = useState<GuestCategoryResult[] | "not_published" | "failed" | null>(null);
  const published = view.kind === "closed" && view.published;

  // Loads again when the status changes, so results appear as soon as the host publishes.
  useEffect(() => {
    fetchResults()
      .then(setResults)
      .catch((err) => setResults(err instanceof ApiError && err.code === "not_published" ? "not_published" : "failed"));
  }, [published]);

  return (
    <main className={PAGE}>
      <StatusBanner view={view} failed={stateFailed} onRetry={refresh} />
      <BackLink href="/">← Home</BackLink>
      <h1 className="mb-4 mt-2 font-title text-5xl text-pumpkin">The winners</h1>
      {results === null && <p className="text-lg">Loading…</p>}
      {results === "failed" && <p className="text-lg">{GENERIC_ERROR}</p>}
      {results === "not_published" && <p className="text-lg">Stand by for the winners to be announced!</p>}
      {Array.isArray(results) && (
        <div className="space-y-8">
          {results.map((c) => (
            <CategoryWinners key={c.category} result={c} />
          ))}
        </div>
      )}
    </main>
  );
}

function CategoryWinners({ result }: { result: GuestCategoryResult }) {
  const [showAll, setShowAll] = useState(false);
  const winners = result.ranked.filter((n) => n.rank === 1);
  return (
    <section className="space-y-3">
      <h2 className="text-center text-2xl font-bold text-violet-100">{result.label}</h2>
      {winners.length === 0 && <p className="text-center text-lg">No votes in this category</p>}
      {winners.length > 1 && <p className="text-center text-lg font-semibold text-pumpkin">It&apos;s a tie!</p>}
      <ul className={winners.length > 1 ? "grid grid-cols-2 gap-3" : ""}>
        {winners.map((n) => {
          const { top, bottom } = labelLines(n);
          return (
            <li key={n.id} className="overflow-hidden rounded-2xl bg-white/5 ring-2 ring-pumpkin">
              <Photo thumbUrl={winners.length > 1 ? n.thumbUrl : undefined} photoUrl={n.photoUrl} alt={singleLine(n)} />
              <div className="px-3 py-2 text-center">
                <p className="text-xl font-bold leading-tight">🏆 {top}</p>
                {bottom && <p className="leading-tight text-violet-200">{bottom}</p>}
              </div>
            </li>
          );
        })}
      </ul>
      {(result.ranked.length > 0 || result.alsoNominated.length > 0) && (
        <button type="button" onClick={() => setShowAll(!showAll)} aria-expanded={showAll} className={`${SECONDARY} w-full`}>
          {showAll ? "Hide full rankings" : "Full rankings"}
        </button>
      )}
      {showAll && (
        <div className="space-y-3 rounded-2xl bg-white/5 px-4 py-3">
          {result.ranked.length > 0 && (
            <ol className="space-y-1 text-lg">
              {result.ranked.map((n) => (
                <li key={n.id} className="flex gap-3">
                  <span className="w-8 shrink-0 text-right font-bold text-pumpkin tabular-nums">{n.rank}.</span>
                  <span>{singleLine(n)}</span>
                </li>
              ))}
            </ol>
          )}
          {result.alsoNominated.length > 0 && (
            <p className="text-violet-200">
              <span className="font-semibold">Also nominated:</span> {result.alsoNominated.map(singleLine).join(", ")}
            </p>
          )}
        </div>
      )}
    </section>
  );
}
