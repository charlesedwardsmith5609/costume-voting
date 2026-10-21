"use client";
import { useEffect } from "react";
import { Photo } from "@/components/Photo";
import type { AdminCategoryResult } from "@/lib/adminApi";
import { labelLines, singleLine } from "@/lib/nomineeLabel";
import { winnersOf } from "@/lib/reveal";

export const SLIDESHOW_AUTO_START_MS = 5 * 60_000;

// Last reveal step: every category's winner(s) at once. The host starts the slideshow with the
// button; if they don't, it starts by itself after five minutes.
export function RevealWinners({ categories, onStartSlideshow }: { categories: AdminCategoryResult[]; onStartSlideshow: () => void }) {
  useEffect(() => {
    const t = setTimeout(onStartSlideshow, SLIDESHOW_AUTO_START_MS);
    return () => clearTimeout(t);
  }, [onStartSlideshow]);

  return (
    <div className="flex h-full min-h-0 w-full flex-col items-center justify-center gap-[2vh]">
      <h2 className="rv-pop font-title text-[7vh] leading-none text-white drop-shadow-[0_0_2vh_rgba(139,92,246,.9)]">
        Congratulations to our winners!
      </h2>
      <ul className="grid min-h-0 w-full max-w-[160vh] grid-cols-2 gap-[2vh] lg:grid-cols-4">
        {categories.map((c) => {
          const winners = winnersOf(c.nominees);
          return (
            <li key={c.category} className="rounded-[2vh] bg-black/40 p-[1.5vh] ring-2 ring-pumpkin/70">
              <h3 className="mb-[1vh] text-[3vh] font-bold text-pumpkin">{c.label}</h3>
              {winners.length === 0 && <p className="py-[4vh] text-[2.4vh] text-violet-200">No votes</p>}
              <div className={winners.length > 1 ? "grid grid-cols-2 gap-[1vh]" : ""}>
                {winners.map((n) => {
                  const { top, bottom } = labelLines(n);
                  return (
                    <div key={n.id} className="mx-auto w-full max-w-[34vh]">
                      <div className="overflow-hidden rounded-[1.5vh]">
                        <Photo thumbUrl={n.thumbUrl} photoUrl={n.photoUrl} alt={singleLine(n)} />
                      </div>
                      <p className="mt-[0.8vh] text-[2.4vh] font-bold leading-tight">🏆 {top}</p>
                      {bottom && <p className="text-[2vh] leading-tight text-violet-200">{bottom}</p>}
                    </div>
                  );
                })}
              </div>
            </li>
          );
        })}
      </ul>
      <button
        type="button"
        onClick={onStartSlideshow}
        className="rounded-[2vh] bg-pumpkin px-[5vh] py-[2vh] text-[3.4vh] font-extrabold text-night"
      >
        Start slideshow 🎞️
      </button>
    </div>
  );
}
