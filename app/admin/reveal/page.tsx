"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { useAdmin } from "@/components/admin/AdminContext";
import { Photo } from "@/components/Photo";
import { SECONDARY } from "@/components/ui";
import { ApiError } from "@/lib/api";
import { adminErrorMessage, fetchAdminResults, type AdminCategoryResult } from "@/lib/adminApi";
import { labelLines, singleLine } from "@/lib/nomineeLabel";

// Full-screen winner reveal for a TV or the host's phone: one category at a time, every tied
// winner shown together. Loaded when opened (reload for fresh tallies). Arrow keys also step.
// Owner: votes, nominees, nominee_categories (read only).
export default function AdminRevealPage() {
  const { expired } = useAdmin();
  const [categories, setCategories] = useState<AdminCategoryResult[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [index, setIndex] = useState(0);

  useEffect(() => {
    fetchAdminResults()
      .then((r) => setCategories(r.categories))
      .catch((err) => {
        const code = err instanceof ApiError ? err.code : "server_error";
        if (code === "unauthorized") return expired();
        setError(adminErrorMessage(code));
      });
  }, [expired]);

  const count = categories?.length ?? 0;
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "ArrowRight") setIndex((i) => Math.min(i + 1, count - 1));
      if (e.key === "ArrowLeft") setIndex((i) => Math.max(i - 1, 0));
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [count]);

  const current = categories?.[index];
  const winners = current?.nominees.filter((n) => n.rank === 1 && n.votes > 0) ?? [];
  const tie = winners.length > 1;

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-night p-4 text-center">
      <div className="flex justify-between">
        <Link href="/admin/results" className="inline-flex min-h-11 items-center text-violet-300">
          ← Exit
        </Link>
        {categories && (
          <span className="inline-flex min-h-11 items-center text-violet-300">
            {index + 1} of {count}
          </span>
        )}
      </div>

      <div className="flex min-h-0 flex-1 flex-col items-center justify-center gap-4">
        {!categories && <p className="text-2xl">{error ?? "Loading…"}</p>}
        {current && (
          <>
            <h1 className="font-title text-5xl text-pumpkin sm:text-7xl">{current.label}</h1>
            {tie && <p className="text-3xl font-semibold">It&apos;s a tie!</p>}
            {winners.length === 0 && <p className="text-3xl">No votes in this category</p>}
            <ul className="flex min-h-0 flex-wrap items-start justify-center gap-6">
              {winners.map((n) => {
                const { top, bottom } = labelLines(n);
                return (
                  <li key={n.id} className="space-y-2">
                    <div
                      className={`mx-auto overflow-hidden rounded-3xl ring-4 ring-pumpkin ${
                        tie ? "w-[min(34vh,44vw)]" : "w-[min(50vh,88vw)]"
                      }`}
                    >
                      <Photo thumbUrl={n.thumbUrl} photoUrl={n.photoUrl} alt={singleLine(n)} />
                    </div>
                    <p className="text-3xl font-bold sm:text-5xl">🏆 {top}</p>
                    {bottom && <p className="text-2xl text-violet-200 sm:text-3xl">{bottom}</p>}
                  </li>
                );
              })}
            </ul>
          </>
        )}
      </div>

      {categories && (
        <div className="grid grid-cols-2 gap-3">
          <button type="button" disabled={index === 0} onClick={() => setIndex(index - 1)} className={SECONDARY}>
            ← Previous
          </button>
          <button type="button" disabled={index >= count - 1} onClick={() => setIndex(index + 1)} className={SECONDARY}>
            Next →
          </button>
        </div>
      )}
    </div>
  );
}
