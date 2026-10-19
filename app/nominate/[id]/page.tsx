"use client";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { BackLink } from "@/components/BackLink";
import { CategoryChecks } from "@/components/CategoryChecks";
import { Photo } from "@/components/Photo";
import { StatusBanner } from "@/components/StatusBanner";
import { PAGE, PRIMARY } from "@/components/ui";
import { addToCategories, ApiError, fetchAllNominees } from "@/lib/api";
import { CATEGORIES, type CategorySlug } from "@/lib/categories";
import { canWrite } from "@/lib/clock";
import { errorMessage, GENERIC_ERROR } from "@/lib/guestErrors";
import { useGuestState } from "@/lib/hooks";
import { labelLines } from "@/lib/nomineeLabel";
import type { GuestNominee } from "@/lib/types";

// "Nominate a costume", step 2: add an existing nominee to more categories. No photo or names
// needed. Current categories are checked and locked.
export default function AddCategoriesPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { view, failed: stateFailed, refresh } = useGuestState();
  const open = canWrite(view);
  const [nominee, setNominee] = useState<GuestNominee | null | "missing" | "failed">(null);
  const [added, setAdded] = useState<CategorySlug[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchAllNominees()
      .then((list) => setNominee(list.find((n) => n.id === id) ?? "missing"))
      .catch(() => setNominee("failed"));
  }, [id]);

  async function save() {
    if (added.length === 0) return setError(errorMessage("no_category"));
    setBusy(true);
    setError(null);
    try {
      await addToCategories(id, added);
      router.push("/");
    } catch (err) {
      const code = err instanceof ApiError ? err.code : "server_error";
      if (code === "already_in_category") return router.push("/");
      if (code === "closed") refresh();
      if (code === "not_found") setNominee("missing");
      setError(errorMessage(code, view.kind === "opens_soon"));
      setBusy(false);
    }
  }

  const loaded = typeof nominee === "object" && nominee !== null ? nominee : null;
  const label = loaded && labelLines(loaded);
  const full = loaded !== null && loaded.categories.length === CATEGORIES.length;

  return (
    <main className={PAGE}>
      <StatusBanner view={view} failed={stateFailed} onRetry={refresh} />
      <BackLink href="/nominate">← Already here?</BackLink>
      <h1 className="mb-4 mt-2 font-title text-4xl text-pumpkin">Add to more categories</h1>
      {nominee === null && <p className="text-lg">Loading…</p>}
      {nominee === "failed" && <p className="text-lg">{GENERIC_ERROR}</p>}
      {nominee === "missing" && (
        <div className="space-y-2">
          <p className="text-lg">Couldn&apos;t find that nominee</p>
          <BackLink href="/nominate">Back to the list</BackLink>
        </div>
      )}
      {loaded && label && (
        <div className="space-y-6">
          <div className="flex items-center gap-4">
            <div className="w-28 shrink-0 overflow-hidden rounded-xl">
              <Photo thumbUrl={loaded.thumbUrl} photoUrl={loaded.photoUrl} alt={label.top} />
            </div>
            <div>
              <p className="text-xl font-semibold leading-tight">{label.top}</p>
              {label.bottom && <p className="leading-tight text-violet-200">{label.bottom}</p>}
            </div>
          </div>
          {full && <p className="text-lg">Already in every category</p>}
          {open && !full && (
            <form
              className="space-y-6"
              onSubmit={(e) => {
                e.preventDefault();
                save();
              }}
            >
              <CategoryChecks checked={added} locked={loaded.categories} disabled={busy} onChange={setAdded} />
              <div className="space-y-2">
                {error && (
                  <p role="alert" className="text-lg font-semibold text-red-300">
                    {error}
                  </p>
                )}
                <button type="submit" disabled={busy} className={`${PRIMARY} w-full`}>
                  Add
                </button>
              </div>
            </form>
          )}
        </div>
      )}
    </main>
  );
}
