"use client";
import { useCallback, useState } from "react";
import { useAdmin } from "@/components/admin/AdminContext";
import { ResultsTable } from "@/components/admin/ResultsTable";
import { ADMIN_PAGE } from "@/components/admin/ui";
import { ApiError } from "@/lib/api";
import { adminErrorMessage, fetchAdminResults, type AdminResults } from "@/lib/adminApi";
import { useOnVisible } from "@/lib/hooks";

const REFRESH_MS = 5_000;

// Live tallies, refreshed every 5 seconds while the tab is visible. A failed refresh keeps the
// last tallies on screen. Owner: votes, nominees, nominee_categories (read only).
export default function AdminResultsPage() {
  const { expired } = useAdmin();
  const [results, setResults] = useState<AdminResults | null>(null);
  const [updatedAt, setUpdatedAt] = useState<Date | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    fetchAdminResults()
      .then((r) => {
        setResults(r);
        setUpdatedAt(new Date());
        setError(null);
      })
      .catch((err) => {
        const code = err instanceof ApiError ? err.code : "server_error";
        if (code === "unauthorized") return expired();
        setError(adminErrorMessage(code));
      });
  }, [expired]);
  useOnVisible(load, REFRESH_MS);

  return (
    <main className={ADMIN_PAGE}>
      <h1 className="mb-4 mt-2 font-title text-4xl text-pumpkin">Results</h1>
      {results ? (
        <>
          <p className="mb-6 text-lg">
            <span className="font-bold tabular-nums">{results.distinctDevices}</span>{" "}
            {results.distinctDevices === 1 ? "phone has" : "phones have"} voted
            {updatedAt && (
              <span className="text-violet-300">
                {" "}
                · updated {updatedAt.toLocaleTimeString([], { hour: "numeric", minute: "2-digit", second: "2-digit" })}
              </span>
            )}
          </p>
          {error && (
            <p role="alert" className="mb-4 font-semibold text-red-300">
              Couldn&apos;t refresh, retrying. {error}
            </p>
          )}
          <div className="space-y-8">
            {results.categories.map((c) => (
              <ResultsTable key={c.category} result={c} />
            ))}
          </div>
        </>
      ) : error ? (
        <p role="alert" className="text-lg font-semibold text-red-300">
          {error} Retrying…
        </p>
      ) : (
        <p className="text-lg">Loading…</p>
      )}
    </main>
  );
}
