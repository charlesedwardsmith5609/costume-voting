"use client";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { useAdmin } from "@/components/admin/AdminContext";
import { CategoryToggles } from "@/components/admin/CategoryToggles";
import { EditHistory } from "@/components/admin/EditHistory";
import { NomineeDetailsForm } from "@/components/admin/NomineeDetailsForm";
import { ADMIN_PAGE } from "@/components/admin/ui";
import { BackLink } from "@/components/BackLink";
import { ApiError } from "@/lib/api";
import {
  adminErrorMessage,
  fetchAdminNominees,
  fetchEdits,
  setCategory,
  undoEdit,
  type AdminNominee,
  type NomineeEdit,
} from "@/lib/adminApi";
import type { CategorySlug } from "@/lib/categories";
import { singleLine } from "@/lib/nomineeLabel";

// One nominee: edit names and photo, and add or remove categories. Read from the admin nominee
// list (there is no single-nominee route). Owner: admin_edit_nominee, admin_set_category,
// undo_nominee_edit.
export default function AdminNomineePage() {
  const { id } = useParams<{ id: string }>();
  const { expired } = useAdmin();
  const [nominee, setNominee] = useState<AdminNominee | "missing" | null>(null);
  const [edits, setEdits] = useState<NomineeEdit[] | null>(null);
  const [version, setVersion] = useState(0);
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fail = useCallback(
    (err: unknown) => {
      const code = err instanceof ApiError ? err.code : "server_error";
      if (code === "unauthorized") return expired();
      if (code === "not_found") setNominee("missing");
      setError(adminErrorMessage(code));
    },
    [expired],
  );

  const load = useCallback(
    () =>
      Promise.all([fetchAdminNominees(), fetchEdits(id)])
        .then(([r, h]) => {
          setNominee(r.nominees.find((n) => n.id === id) ?? "missing");
          setEdits(h.edits);
        })
        .catch(fail),
    [id, fail],
  );
  // Loaded once (and after each save), so a background refresh never resets what the host is typing.
  useEffect(() => {
    load();
  }, [load]);

  async function toggle(category: CategorySlug, present: boolean) {
    setBusy(true);
    setError(null);
    setSaved(false);
    try {
      await setCategory(id, category, present);
    } catch (err) {
      fail(err);
    } finally {
      await load();
      setBusy(false);
    }
  }

  async function undo(editId: number) {
    setBusy(true);
    setError(null);
    setSaved(false);
    try {
      await undoEdit(editId);
      setVersion((v) => v + 1);
    } catch (err) {
      fail(err);
    } finally {
      await load();
      setBusy(false);
    }
  }

  return (
    <main className={ADMIN_PAGE}>
      <BackLink href="/admin/nominees">← Nominees</BackLink>
      {nominee === null && !error && <p className="mt-4 text-lg">Loading…</p>}
      {nominee === "missing" && <p className="mt-4 text-lg">{adminErrorMessage("not_found")}</p>}
      {nominee === null && error && (
        <p role="alert" className="mt-4 text-lg font-semibold text-red-300">
          {error}
        </p>
      )}
      {typeof nominee === "object" && nominee !== null && (
        <>
          <h1 className="mb-4 mt-2 font-title text-4xl text-pumpkin">
            {singleLine(nominee)}
            {nominee.hidden && (
              <span className="ml-3 align-middle rounded bg-zinc-700 px-2 py-0.5 font-sans text-base text-zinc-200">Hidden</span>
            )}
          </h1>
          <div className="space-y-8">
            {saved && (
              <p role="status" className="rounded-xl bg-white/5 px-4 py-3 text-lg font-semibold text-violet-100">
                ✓ Saved
              </p>
            )}
            <NomineeDetailsForm
              key={version}
              nominee={nominee}
              onSaved={() =>
                load().then(() => {
                  setVersion((v) => v + 1);
                  setSaved(true);
                })
              }
            />
            <section className="space-y-3">
              <h2 className="text-2xl font-bold">Categories</h2>
              {error && (
                <p role="alert" className="text-lg font-semibold text-red-300">
                  {error}
                </p>
              )}
              <CategoryToggles categories={nominee.categories} disabled={busy} onToggle={toggle} />
            </section>
            <section className="space-y-3">
              <h2 className="text-2xl font-bold">Edit history</h2>
              {edits && <EditHistory edits={edits} disabled={busy} onUndo={undo} />}
            </section>
          </div>
        </>
      )}
    </main>
  );
}
