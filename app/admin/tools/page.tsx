"use client";
import Link from "next/link";
import { useState } from "react";
import { useAdmin } from "@/components/admin/AdminContext";
import { ADMIN_PAGE } from "@/components/admin/ui";
import { INPUT, PRIMARY, SECONDARY } from "@/components/ui";
import { ApiError } from "@/lib/api";
import { adminErrorMessage, resetAll, type ResetResult } from "@/lib/adminApi";

// CSV export and the guarded Reset. Owner: reset_all (every table) and Storage, via the reset route.
export default function AdminToolsPage() {
  const { expired } = useAdmin();
  const [typed, setTyped] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<ResetResult | null>(null);

  async function reset() {
    setBusy(true);
    setError(null);
    setResult(null);
    try {
      setResult(await resetAll());
      setTyped("");
    } catch (err) {
      const code = err instanceof ApiError ? err.code : "server_error";
      if (code === "unauthorized") return expired();
      setError(adminErrorMessage(code));
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className={ADMIN_PAGE}>
      <h1 className="mb-4 font-title text-4xl text-pumpkin">Tools</h1>
      <div className="space-y-8">
        <section className="space-y-3">
          <h2 className="text-2xl font-bold">Winner reveal</h2>
          <p className="text-lg">A full-screen view of the winners, one category at a time, for a TV or your phone.</p>
          <Link href="/admin/reveal" className={`${PRIMARY} w-full`}>
            Open winner reveal
          </Link>
          <p className="text-lg">On your phone, open the remote to run it from your hand.</p>
          <Link href="/admin/remote" className={`${SECONDARY} w-full`}>
            Open phone remote
          </Link>
        </section>

        <section className="space-y-3">
          <h2 className="text-2xl font-bold">Slideshow photos</h2>
          <p className="text-lg">Choose which photos appear in the final slideshow after the winner reveal.</p>
          <Link href="/admin/slideshow" className={`${SECONDARY} w-full`}>
            Manage slideshow photos
          </Link>
        </section>

        <section className="space-y-3">
          <h2 className="text-2xl font-bold">Export results</h2>
          <p className="text-lg">A CSV of every nominee in every category, with ranks and vote counts.</p>
          <a href="/api/admin/export" download className={`${SECONDARY} w-full`}>
            Download CSV
          </a>
        </section>

        <section className="space-y-3 rounded-2xl bg-red-950/60 px-4 py-4 ring-1 ring-red-400/50">
          <h2 className="text-2xl font-bold">Reset everything</h2>
          <p className="text-lg">
            Deletes all votes, nominees, edit history, photos, and the timer. For testing before the party. Never run it
            while guests are nominating or voting.
          </p>
          <form
            className="space-y-3"
            onSubmit={(e) => {
              e.preventDefault();
              if (typed === "RESET") reset();
            }}
          >
            <label className="block space-y-2">
              <span className="text-lg font-semibold">Type RESET to confirm</span>
              <input
                value={typed}
                onChange={(e) => setTyped(e.target.value)}
                autoCapitalize="characters"
                autoComplete="off"
                autoCorrect="off"
                spellCheck={false}
                className={INPUT}
              />
            </label>
            <button type="submit" disabled={busy || typed !== "RESET"} className={`${PRIMARY} w-full`}>
              Reset everything
            </button>
          </form>
          {result && (
            <p role="status" className="text-lg font-semibold text-violet-100">
              ✓ Everything was reset.
              {result.photosNotRemoved > 0 &&
                ` ${result.photosNotRemoved} photo${result.photosNotRemoved === 1 ? "" : "s"} could not be deleted from storage.`}
            </p>
          )}
          {error && (
            <p role="alert" className="text-lg font-semibold text-red-300">
              {error}
            </p>
          )}
        </section>
      </div>
    </main>
  );
}
