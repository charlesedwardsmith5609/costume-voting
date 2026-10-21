"use client";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { useAdmin } from "@/components/admin/AdminContext";
import { RevealSlideshow } from "@/components/admin/RevealSlideshow";
import { RevealWinners } from "@/components/admin/RevealWinners";
import { Celebration, RevealStage } from "@/components/admin/RevealStage";
import { RevealScenery } from "@/components/admin/RevealScenery";
import { SECONDARY } from "@/components/ui";
import { ApiError } from "@/lib/api";
import { adminErrorMessage, fetchAdminResults, type AdminCategoryResult } from "@/lib/adminApi";
import { winnersOf } from "@/lib/reveal";
import { createRevealAudio, type RevealAudio } from "@/lib/revealSound";

// Full-screen winner reveal for a TV (16:9) or the host's phone: one category at a time, each
// hidden behind a "?" card until tapped. Tied winners flip together. Winners are loaded when the
// page opens (reload for fresh tallies). The first tap unlocks sound. Space/Enter reveal and
// the arrow keys step. Owner: votes, nominees, nominee_categories (read only).
export default function AdminRevealPage() {
  const { expired } = useAdmin();
  const [categories, setCategories] = useState<AdminCategoryResult[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [started, setStarted] = useState(false);
  const [muted, setMuted] = useState(false);
  const [index, setIndex] = useState(0);
  const [revealed, setRevealed] = useState<Set<number>>(new Set());
  const [rolling, setRolling] = useState(false);
  const [slideshow, setSlideshow] = useState(false);
  const [slideshowUsed, setSlideshowUsed] = useState(false);
  const audio = useRef<RevealAudio | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  useEffect(() => {
    fetchAdminResults()
      .then((r) => setCategories(r.categories))
      .catch((err) => {
        const code = err instanceof ApiError ? err.code : "server_error";
        if (code === "unauthorized") return expired();
        setError(adminErrorMessage(code));
      });
  }, [expired]);

  useEffect(
    () => () => {
      clearTimeout(timer.current);
      audio.current?.stop();
    },
    [],
  );

  const count = categories?.length ?? 0;
  const current = categories?.[index];
  const winners = current ? winnersOf(current.nominees) : [];
  const isRevealed = revealed.has(index);
  // One step past the last category: all the winners together.
  const final = categories !== null && index === count;

  const reveal = useCallback(() => {
    if (!current || rolling || revealed.has(index)) return;
    const finish = () => {
      setRolling(false);
      setRevealed((s) => new Set(s).add(index));
      if (winnersOf(current.nominees).length) audio.current?.celebrate();
    };
    if (!winnersOf(current.nominees).length || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return finish();
    setRolling(true);
    audio.current?.drumroll();
    timer.current = setTimeout(finish, ((audio.current?.drumrollSeconds() ?? 2.2) + 0.1) * 1000);
  }, [current, index, revealed, rolling]);

  const step = useCallback(
    (to: number) => {
      if (!rolling) setIndex(Math.min(Math.max(to, 0), count));
    },
    [rolling, count],
  );

  useEffect(() => {
    if (final) audio.current?.celebrate();
  }, [final]);

  const startSlideshow = useCallback(() => {
    setSlideshow(true);
    setSlideshowUsed(true);
  }, []);
  const exitSlideshow = useCallback(() => setSlideshow(false), []);

  useEffect(() => {
    if (!started || slideshow) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "ArrowRight") step(index + 1);
      else if (e.key === "ArrowLeft") step(index - 1);
      else if (e.key === " " || e.key === "Enter") {
        e.preventDefault();
        reveal();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [started, slideshow, index, step, reveal]);

  function begin() {
    audio.current = createRevealAudio();
    audio.current?.start();
    setStarted(true);
  }

  function toggleMute() {
    audio.current?.setMuted(!muted);
    setMuted(!muted);
  }

  return (
    <div className="fixed inset-0 z-50 flex flex-col overflow-hidden text-center text-violet-50">
      <RevealScenery />
      <header className="relative px-4 pt-[2vh]">
        <h1 className="font-title text-[6vh] leading-none text-pumpkin drop-shadow-[0_0_2vh_rgba(255,122,26,.6)]">
          The Charlies&apos; Halloween Party 2026
        </h1>
        <p className="mt-[1vh] text-[3vh] font-semibold tracking-wide text-violet-100">Costume Contest Winners</p>
      </header>

      {!started ? (
        <div className="relative flex flex-1 flex-col items-center justify-center gap-[3vh]">
          {!categories && <p className="text-[3vh]">{error ?? "Loading…"}</p>}
          {categories && (
            <button
              type="button"
              onClick={begin}
              className="rv-pulse rounded-[3vh] bg-pumpkin px-[6vh] py-[3vh] text-[5vh] font-extrabold text-night"
            >
              Tap to start 🎃
            </button>
          )}
          <Link href="/admin/slideshow" className="text-violet-200 underline underline-offset-4">
            Manage slideshow photos
          </Link>
          <Link href="/admin/tools" className="text-violet-200 underline underline-offset-4">
            ← Exit
          </Link>
        </div>
      ) : (
        <>
          <main
            className={`relative grid min-h-0 flex-1 items-center gap-[2vh] px-[3vw] pt-[2vh] ${
              final ? "" : "grid-rows-[auto_1fr] lg:grid-cols-[1fr_1.8fr] lg:grid-rows-1"
            }`}
          >
            {final && categories && <RevealWinners categories={categories} autoStart={!slideshowUsed} onStartSlideshow={startSlideshow} />}
            {current && (
              <div className="space-y-[3vh]">
                <h2 className="font-title text-[8vh] leading-none text-white drop-shadow-[0_0_2vh_rgba(139,92,246,.9)]">
                  {current.label}
                </h2>
                <p className="flex justify-center gap-[1.5vh]" aria-label={`Category ${index + 1} of ${count}`}>
                  {categories!.map((c, i) => (
                    <span
                      key={c.category}
                      className={`size-[2vh] rounded-full ${i === index ? "bg-pumpkin" : revealed.has(i) ? "bg-witch" : "bg-white/25"}`}
                    />
                  ))}
                </p>
              </div>
            )}
            {!final && (
              <div className="relative h-full min-h-0">
                {current && (
                  <RevealStage key={index} winners={winners} revealed={isRevealed} rolling={rolling} onReveal={reveal} />
                )}
              </div>
            )}
          </main>
          {(final || (isRevealed && winners.length > 0)) && <Celebration key={index} />}
          {slideshow && <RevealSlideshow onExit={exitSlideshow} />}
          <footer className="relative grid grid-cols-[auto_1fr_1fr_auto] items-center gap-3 px-4 py-3 opacity-60 transition-opacity hover:opacity-100">
            <Link href="/admin/tools" className="inline-flex min-h-11 items-center px-2 text-violet-200">
              ← Exit
            </Link>
            <button type="button" disabled={index === 0 || rolling} onClick={() => step(index - 1)} className={SECONDARY}>
              ← Previous
            </button>
            <button type="button" disabled={index >= count || rolling} onClick={() => step(index + 1)} className={SECONDARY}>
              Next →
            </button>
            <button type="button" onClick={toggleMute} aria-pressed={muted} className="min-h-11 px-2 text-2xl">
              {muted ? "🔇" : "🔊"}
            </button>
          </footer>
        </>
      )}
    </div>
  );
}
