"use client";
import { useState } from "react";
import { Photo } from "@/components/Photo";
import { INPUT, PRIMARY, SECONDARY } from "@/components/ui";
import type { AdminNominee } from "@/lib/adminApi";
import { categoryLabel } from "@/lib/categories";
import { singleLine } from "@/lib/nomineeLabel";
import { filterByName } from "@/lib/search";

// Merge a duplicate into this nominee (or this one into the duplicate, via Swap). The kept nominee
// keeps its names and photo and gains the other's categories and votes; the other is removed.
// Owner: merge_nominees.
export function MergePanel({
  current,
  others,
  disabled,
  onMerge,
}: {
  current: AdminNominee;
  others: AdminNominee[];
  disabled: boolean;
  onMerge: (keepId: string, dropId: string) => void;
}) {
  const [query, setQuery] = useState("");
  const [picked, setPicked] = useState<AdminNominee | null>(null);
  const [swapped, setSwapped] = useState(false);

  if (picked) {
    const keep = swapped ? picked : current;
    const drop = swapped ? current : picked;
    return (
      <div className="space-y-3">
        <div className="grid grid-cols-2 gap-3">
          {(
            [
              ["Keep", keep, "ring-pumpkin"],
              ["Remove", drop, "ring-red-400/50"],
            ] as const
          ).map(([title, n, ring]) => (
            <div key={title} className={`overflow-hidden rounded-2xl bg-white/5 ring-2 ${ring}`}>
              <Photo thumbUrl={n.thumbUrl} photoUrl={n.photoUrl} alt={singleLine(n)} />
              <div className="space-y-1 px-3 py-2">
                <p className="font-bold">{title}</p>
                <p className="leading-tight">{singleLine(n)}</p>
                <p className="text-sm text-violet-200">{n.categories.map(categoryLabel).join(" · ")}</p>
              </div>
            </div>
          ))}
        </div>
        <div className="grid grid-cols-2 gap-3">
          <button type="button" disabled={disabled} onClick={() => setSwapped(!swapped)} className={SECONDARY}>
            Swap
          </button>
          <button type="button" disabled={disabled} onClick={() => setPicked(null)} className={SECONDARY}>
            Pick another
          </button>
        </div>
        <button
          type="button"
          disabled={disabled}
          onClick={() => {
            if (window.confirm(`Merge ${singleLine(drop)} into ${singleLine(keep)}? ${singleLine(drop)} is removed. This can't be undone.`)) {
              onMerge(keep.id, drop.id);
            }
          }}
          className={`${PRIMARY} w-full`}
        >
          Merge
        </button>
      </div>
    );
  }

  const shown = filterByName(others, query);
  return (
    <div className="space-y-3">
      <input
        type="search"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Find the duplicate"
        aria-label="Find the duplicate"
        className={INPUT}
      />
      {shown.length === 0 && <p className="text-lg text-violet-200">No other nominees found.</p>}
      <ul className="max-h-96 space-y-2 overflow-y-auto">
        {shown.map((n) => (
          <li key={n.id}>
            <button
              type="button"
              onClick={() => {
                setPicked(n);
                setSwapped(false);
              }}
              className="flex min-h-14 w-full items-center gap-3 rounded-xl bg-white/5 px-3 py-2 text-left"
            >
              <div className="w-12 shrink-0 overflow-hidden rounded-lg">
                <Photo thumbUrl={n.thumbUrl} photoUrl={n.photoUrl} alt="" />
              </div>
              <span className="min-w-0 truncate text-lg font-semibold">
                {n.hidden && <span className="mr-2 rounded bg-zinc-700 px-1.5 py-0.5 text-sm">Hidden</span>}
                {singleLine(n)}
              </span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
