"use client";
import Link from "next/link";
import { useCallback, useState } from "react";
import { StatusBanner } from "@/components/StatusBanner";
import { PAGE, PRIMARY } from "@/components/ui";
import { fetchMyVotes } from "@/lib/api";
import { canWrite } from "@/lib/clock";
import { CATEGORIES, type CategorySlug } from "@/lib/categories";
import { useGuestState, useOnVisible } from "@/lib/hooks";

// Home: voting status, help link, title, the four categories with a checkmark where this
// device voted, and "Nominate a costume" below them while voting is open.
export default function Home() {
  const { view, failed: stateFailed, refresh } = useGuestState();
  const [votes, setVotes] = useState<Partial<Record<CategorySlug, string>>>({});
  const loadVotes = useCallback(() => {
    fetchMyVotes().then(setVotes).catch(() => {});
  }, []);
  useOnVisible(loadVotes);

  return (
    <main className={PAGE}>
      <StatusBanner view={view} failed={stateFailed} onRetry={refresh} />
      <div className="flex justify-end">
        <Link
          href="/help"
          aria-label="How it works"
          className="inline-flex size-11 items-center justify-center rounded-full text-xl font-bold text-violet-200 ring-1 ring-witch/60 active:bg-white/10"
        >
          ?
        </Link>
      </div>
      <h1 className="text-center font-title text-5xl leading-tight text-pumpkin">The Charlies Costume Contest 2026</h1>
      <p className="mt-2 text-center text-xl">Vote for your favorite costumes!</p>
      {view.kind === "closed" && view.published && (
        <Link href="/results" className={`${PRIMARY} mt-6 min-h-16 w-full text-xl`}>
          🏆 See the winners
        </Link>
      )}

      <section className="mt-8">
        <h2 className="text-2xl font-bold">Vote</h2>
        <p className="mb-3 text-violet-200">
          Tap a category to see the nominees and vote. You can change your vote until voting closes.
        </p>
        <ul className="space-y-3">
          {CATEGORIES.map(({ slug, label }) => (
            <li key={slug}>
              <Link
                href={`/c/${slug}`}
                className="flex min-h-16 items-center justify-between gap-3 rounded-2xl bg-white/5 px-5 text-xl font-semibold ring-1 ring-witch/40 active:bg-white/10"
              >
                <span>{label}</span>
                {votes[slug] && <span className="shrink-0 text-base text-pumpkin">✓ Voted</span>}
              </Link>
            </li>
          ))}
        </ul>
      </section>

      {canWrite(view) && (
        <section className="mt-8">
          <h2 className="text-2xl font-bold">Nominate</h2>
          <p className="mb-3 text-violet-200">Spot a great costume? Add it so people can vote for it.</p>
          <Link href="/nominate" className={`${PRIMARY} min-h-16 w-full text-xl`}>
            Nominate a costume
          </Link>
        </section>
      )}
    </main>
  );
}
