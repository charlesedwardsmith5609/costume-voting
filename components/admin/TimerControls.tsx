"use client";
import { useState } from "react";
import { useAdmin } from "@/components/admin/AdminContext";
import { INPUT, PRIMARY, SECONDARY } from "@/components/ui";
import { ApiError } from "@/lib/api";
import { adminErrorMessage, endVoting, extendTimer, setPublished, startTimer } from "@/lib/adminApi";
import { closesAtForServer, closeTimeProblem, defaultClose } from "@/lib/adminTime";
import { formatCloseTime, formatCountdown } from "@/lib/clock";
import { useGuestState } from "@/lib/hooks";

const DEFAULT_MINUTES = 120;

// Start (by close time, the default, or by duration), extend, end, reopen, and publish results
// after close. The status comes
// from /api/state, the same answer guests get.
// Owner: set_timer, set_results_published (settings).
export function TimerControls() {
  const { expired } = useAdmin();
  const { state, view, failed, refresh } = useGuestState();
  const [mode, setMode] = useState<"close_time" | "duration">("close_time");
  const [closeValue, setCloseValue] = useState(() => defaultClose(Date.now()));
  const [minutes, setMinutes] = useState(String(DEFAULT_MINUTES));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function act(run: () => Promise<unknown>) {
    setBusy(true);
    setError(null);
    try {
      await run();
      refresh();
    } catch (err) {
      const code = err instanceof ApiError ? err.code : "server_error";
      if (code === "unauthorized") return expired();
      setError(adminErrorMessage(code));
    } finally {
      setBusy(false);
    }
  }

  function start() {
    if (view.kind === "closed" && view.published && !window.confirm("Reopening voting unpublishes the results. Reopen?")) return;
    if (mode === "close_time") {
      const problem = closeTimeProblem(closeValue, Date.now());
      if (problem) return setError(problem);
      return act(() => startTimer({ closesAt: closesAtForServer(closeValue)! }));
    }
    const n = Number(minutes);
    if (!Number.isInteger(n) || n < 1 || n > 600) return setError("Pick a duration from 1 to 600 minutes");
    return act(() => startTimer({ minutes: n }));
  }

  function end() {
    if (window.confirm("End voting now? Guests can no longer vote, nominate, or edit.")) act(endVoting);
  }

  const open = view.kind === "open_until" || view.kind === "countdown";
  const closesAt = state?.votingClosesAt ? new Date(state.votingClosesAt) : null;
  const status =
    view.kind === "loading"
      ? failed
        ? "Couldn't load the voting status."
        : "Loading…"
      : view.kind === "opens_soon"
        ? "Voting has not started."
        : view.kind === "open_until"
          ? `Voting is open until ${formatCloseTime(view.closesAt, view.now)}.`
          : view.kind === "countdown"
            ? `Voting closes in ${formatCountdown(view.msLeft)}.`
            : `Voting closed${closesAt ? ` at ${formatCloseTime(closesAt, new Date())}` : ""}.`;

  return (
    <div className="space-y-6">
      <p role="status" className="rounded-2xl bg-white/5 px-4 py-3 text-xl font-semibold ring-1 ring-witch/40">
        {status}
      </p>

      {open && (
        <section className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <button type="button" disabled={busy} onClick={() => act(() => extendTimer(5))} className={SECONDARY}>
              + 5 minutes
            </button>
            <button type="button" disabled={busy} onClick={() => act(() => extendTimer(10))} className={SECONDARY}>
              + 10 minutes
            </button>
          </div>
          <button type="button" disabled={busy} onClick={end} className={`${SECONDARY} w-full`}>
            End voting now
          </button>
        </section>
      )}

      {view.kind === "closed" && (
        <section className="space-y-3 rounded-2xl bg-white/5 px-4 py-4 ring-1 ring-pumpkin/50">
          <h2 className="text-2xl font-bold">Results for guests</h2>
          <p className="text-lg">
            {view.published
              ? "Published: guests see the winners and the rankings (never vote counts)."
              : "Not published: guests see “Votes are in! Stand by for the winners to be announced.”"}
          </p>
          <button
            type="button"
            disabled={busy}
            onClick={() => {
              const next = !view.published;
              if (next && !window.confirm("Publish results? Every guest will see the winners right away.")) return;
              act(() => setPublished(next));
            }}
            className={`${view.published ? SECONDARY : PRIMARY} w-full`}
          >
            {view.published ? "Unpublish results" : "Publish results"}
          </button>
        </section>
      )}

      {(view.kind === "opens_soon" || view.kind === "closed") && (
        <form
          className="space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            start();
          }}
        >
          <h2 className="text-2xl font-bold">{view.kind === "closed" ? "Reopen voting" : "Start voting"}</h2>
          <fieldset className="flex gap-2" disabled={busy}>
            {(
              [
                ["close_time", "Close at a time"],
                ["duration", "Run for a duration"],
              ] as const
            ).map(([value, label]) => (
              <label
                key={value}
                className={`flex min-h-12 flex-1 items-center justify-center rounded-xl px-3 text-center font-semibold ring-1 ${
                  mode === value ? "bg-witch/30 ring-witch" : "bg-white/5 ring-white/15"
                }`}
              >
                <input type="radio" name="mode" value={value} checked={mode === value} onChange={() => setMode(value)} className="sr-only" />
                {label}
              </label>
            ))}
          </fieldset>
          {mode === "close_time" ? (
            <label className="block space-y-2">
              <span className="text-lg font-semibold">Closing time</span>
              <input
                type="datetime-local"
                value={closeValue}
                onChange={(e) => setCloseValue(e.target.value)}
                className={INPUT}
              />
              {!closeValue && <span className="block text-violet-200">Pick a closing time</span>}
            </label>
          ) : (
            <label className="block space-y-2">
              <span className="text-lg font-semibold">Minutes</span>
              <input
                type="number"
                inputMode="numeric"
                min={1}
                max={600}
                value={minutes}
                onChange={(e) => setMinutes(e.target.value)}
                className={INPUT}
              />
            </label>
          )}
          <button type="submit" disabled={busy} className={`${PRIMARY} w-full`}>
            {view.kind === "closed" ? "Reopen voting" : "Start voting"}
          </button>
        </form>
      )}

      {error && (
        <p role="alert" className="text-lg font-semibold text-red-300">
          {error}
        </p>
      )}
    </div>
  );
}
