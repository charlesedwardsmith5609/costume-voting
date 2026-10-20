"use client";
import { useCallback, useState } from "react";
import { useAdmin } from "@/components/admin/AdminContext";
import { NomineeRow } from "@/components/admin/NomineeRow";
import { ADMIN_PAGE } from "@/components/admin/ui";
import { INPUT } from "@/components/ui";
import { ApiError } from "@/lib/api";
import { adminErrorMessage, deleteNominee, fetchAdminNominees, setHidden, type AdminNominee } from "@/lib/adminApi";
import { useOnVisible } from "@/lib/hooks";
import { singleLine } from "@/lib/nomineeLabel";
import { filterByName } from "@/lib/search";

type Filter = "all" | "visible" | "hidden";
const FILTERS: [Filter, string][] = [
  ["all", "All"],
  ["visible", "Visible"],
  ["hidden", "Hidden"],
];

// Moderation list: every nominee, hidden ones included, newest first. Reloads when the tab
// becomes visible and after each action. Owner: nominees (hidden; delete cascades to
// nominee_categories, votes, nominee_edits).
export default function AdminNomineesPage() {
  const { expired } = useAdmin();
  const [nominees, setNominees] = useState<AdminNominee[] | null>(null);
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<Filter>("all");
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const fail = useCallback(
    (err: unknown) => {
      const code = err instanceof ApiError ? err.code : "server_error";
      if (code === "unauthorized") return expired();
      setError(adminErrorMessage(code));
    },
    [expired],
  );

  const load = useCallback(() => {
    fetchAdminNominees()
      .then((r) => setNominees(r.nominees))
      .catch(fail);
  }, [fail]);
  useOnVisible(load);

  async function act(id: string, run: () => Promise<unknown>) {
    setBusyId(id);
    setError(null);
    try {
      await run();
    } catch (err) {
      fail(err);
    } finally {
      setBusyId(null);
      load();
    }
  }

  function remove(n: AdminNominee) {
    const ok = window.confirm(`Delete ${singleLine(n)}? This removes their votes and edit history and can't be undone.`);
    if (ok) act(n.id, () => deleteNominee(n.id));
  }

  const all = nominees ?? [];
  const counts = { all: all.length, visible: all.filter((n) => !n.hidden).length, hidden: all.filter((n) => n.hidden).length };
  const shown = filterByName(
    all.filter((n) => filter === "all" || n.hidden === (filter === "hidden")),
    query,
  );

  return (
    <main className={ADMIN_PAGE}>
      <h1 className="mb-4 mt-2 font-title text-4xl text-pumpkin">Nominees</h1>
      {error && (
        <p role="alert" className="mb-4 text-lg font-semibold text-red-300">
          {error}
        </p>
      )}
      {nominees === null ? (
        !error && <p className="text-lg">Loading…</p>
      ) : (
        <div className="space-y-4">
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search by name or costume"
            aria-label="Search nominees"
            className={INPUT}
          />
          <div className="flex gap-2" role="group" aria-label="Show">
            {FILTERS.map(([value, label]) => (
              <button
                key={value}
                type="button"
                aria-pressed={filter === value}
                onClick={() => setFilter(value)}
                className={`min-h-11 flex-1 rounded-xl px-3 font-semibold ring-1 ${
                  filter === value ? "bg-witch/30 ring-witch" : "bg-white/5 ring-white/15"
                }`}
              >
                {label} ({counts[value]})
              </button>
            ))}
          </div>
          {shown.length === 0 ? (
            <p className="text-lg text-violet-200">{all.length === 0 ? "No nominees yet" : "No matches"}</p>
          ) : (
            <ul className="space-y-2">
              {shown.map((n) => (
                <NomineeRow
                  key={n.id}
                  nominee={n}
                  busy={busyId === n.id}
                  onHide={() => act(n.id, () => setHidden(n.id, !n.hidden))}
                  onDelete={() => remove(n)}
                />
              ))}
            </ul>
          )}
        </div>
      )}
    </main>
  );
}
