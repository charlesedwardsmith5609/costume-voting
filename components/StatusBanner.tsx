import { formatCountdown, formatTime, type StatusView } from "@/lib/clock";
import { GENERIC_ERROR } from "@/lib/guestErrors";
import { SECONDARY } from "./ui";

// Full-width strip pinned to the top of the screen. Render it first in the page's <main>
// (PAGE): the negative margins cancel the page padding so it runs edge to edge.
const STRIP = "sticky top-0 z-20 -mx-4 -mt-4 mb-4 px-4 py-2 text-center";

// Voting status (SPEC "Home screen"); the last 15 minutes are orange with a countdown.
// If the status never loaded and the last try failed, says so with a retry; polling continues.
export function StatusBanner({ view, failed, onRetry }: { view: StatusView; failed: boolean; onRetry: () => void }) {
  if (view.kind === "loading" && failed) {
    return (
      <div role="alert" className={`${STRIP} space-y-2 border-b border-red-300/40 bg-red-950 py-3`}>
        <p className="text-lg font-semibold">{GENERIC_ERROR}</p>
        <button type="button" onClick={onRetry} className={SECONDARY}>
          Try again
        </button>
      </div>
    );
  }
  if (view.kind === "countdown") {
    return (
      <div role="status" className={`${STRIP} bg-pumpkin text-night`}>
        <p className="text-lg font-extrabold leading-tight">Voting closes soon!</p>
        <p className="font-semibold tabular-nums leading-tight">🕒 Voting closes in {formatCountdown(view.msLeft)}</p>
      </div>
    );
  }
  const text =
    view.kind === "loading"
      ? "Loading…"
      : view.kind === "opens_soon"
        ? "Voting opens soon"
        : view.kind === "closed"
          ? "Voting is closed"
          : `Voting open until ${formatTime(view.closesAt)}`;
  const colors =
    view.kind === "closed" ? "border-zinc-600 bg-zinc-800 text-zinc-200" : "border-witch/50 bg-violet-950 text-violet-100";
  return (
    <p role="status" className={`${STRIP} border-b font-semibold ${colors}`}>
      🕒 {text}
    </p>
  );
}
