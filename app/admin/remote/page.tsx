"use client";
import Link from "next/link";
import { useCallback, useState } from "react";
import { useAdmin } from "@/components/admin/AdminContext";
import { ADMIN_PAGE } from "@/components/admin/ui";
import { PRIMARY, SECONDARY } from "@/components/ui";
import { ApiError } from "@/lib/api";
import { adminErrorMessage, fetchRevealRemote, sendRevealCommand, type RevealRemote } from "@/lib/adminApi";
import { useOnVisible } from "@/lib/hooks";
import { canGoBack, mainAction, type RevealCommand } from "@/lib/revealRemote";

const POLL_MS = 1000;
// After a tap, buttons wait this long so a double tap can't skip a step.
const LOCK_MS = 1000;

// Phone remote for the winner reveal on the TV (/admin/reveal): one big button for the next
// step, plus Previous and Mute. Shows the current category and, before the reveal, who won.
// Owner: reveal_remote.
export default function AdminRemotePage() {
  const { expired } = useAdmin();
  const [remote, setRemote] = useState<RevealRemote | null>(null);
  const [locked, setLocked] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fail = useCallback(
    (err: unknown) => {
      const code = err instanceof ApiError ? err.code : "server_error";
      if (code === "unauthorized") return expired();
      setError(adminErrorMessage(code));
    },
    [expired],
  );

  useOnVisible(() => {
    fetchRevealRemote()
      .then((r) => {
        setRemote(r);
        setError(null);
      })
      .catch(fail);
  }, POLL_MS);

  async function send(command: RevealCommand) {
    setLocked(true);
    setTimeout(() => setLocked(false), LOCK_MS);
    try {
      await sendRevealCommand(command);
    } catch (err) {
      fail(err);
    }
  }

  const state = remote?.tvConnected ? remote.state : null;
  const main = state && mainAction(state);
  const showWinners = state?.step === "category" && !state.revealed && state.winners.length > 0;

  return (
    <main className={ADMIN_PAGE}>
      <h1 className="mb-4 mt-2 font-title text-4xl text-pumpkin">Reveal remote</h1>
      {!remote && !error && <p className="text-lg">Loading…</p>}
      {error && (
        <p role="alert" className="mb-4 text-lg font-semibold text-red-300">
          {error}
        </p>
      )}
      {remote && !state && (
        <div className="space-y-3 text-lg">
          <p className="font-semibold">The TV page isn&apos;t connected.</p>
          <p>Open the winner reveal on the TV and tap “Tap to start”.</p>
          <Link href="/admin/reveal" className={`${SECONDARY} w-full`}>
            Open winner reveal here
          </Link>
        </div>
      )}
      {state && main && (
        <div className="space-y-4">
          <p role="status" className="rounded-2xl bg-white/5 px-4 py-3 text-xl font-semibold ring-1 ring-witch/40">
            {state.step === "category" && `${state.label} · ${state.index + 1} of ${state.count}`}
            {state.step === "start" && "TV is waiting to start"}
            {state.step === "winners" && "All winners are on screen"}
            {state.step === "slideshow" && "Slideshow is playing"}
          </p>
          {showWinners && (
            <div className="rounded-2xl bg-pumpkin/15 px-4 py-3 ring-1 ring-pumpkin/60">
              <p className="text-sm font-semibold uppercase tracking-wide text-pumpkin">
                {state.winners.length > 1 ? "Tie! Winners (only you can see this)" : "Winner (only you can see this)"}
              </p>
              <ul className="mt-1 text-2xl font-bold">
                {state.winners.map((w) => (
                  <li key={w}>🏆 {w}</li>
                ))}
              </ul>
            </div>
          )}
          {state.step === "category" && !state.revealed && state.winners.length === 0 && (
            <p className="text-lg text-violet-200">No votes in this category.</p>
          )}
          <button
            type="button"
            disabled={locked || main.command === null}
            onClick={() => main.command && send(main.command)}
            className={`${PRIMARY} min-h-32 w-full text-3xl`}
          >
            {main.label}
          </button>
          <div className="grid grid-cols-2 gap-3">
            <button type="button" disabled={locked || !canGoBack(state)} onClick={() => send("previous")} className={SECONDARY}>
              ← Previous
            </button>
            <button type="button" disabled={locked} onClick={() => send("mute_toggle")} className={SECONDARY}>
              {state.muted ? "🔇 Unmute" : "🔊 Mute"}
            </button>
          </div>
        </div>
      )}
    </main>
  );
}
