"use client";
import { notFound, useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { BackLink } from "@/components/BackLink";
import { CategoryChecks } from "@/components/CategoryChecks";
import { cleanName, NameFields } from "@/components/NameFields";
import { PhotoPicker } from "@/components/PhotoPicker";
import { StatusBanner } from "@/components/StatusBanner";
import { PAGE, PRIMARY } from "@/components/ui";
import { editNominee, fetchNominees } from "@/lib/api";
import { canWrite } from "@/lib/clock";
import { categoryLabel, isCategory, type CategorySlug } from "@/lib/categories";
import { errorMessage, GENERIC_ERROR } from "@/lib/guestErrors";
import { useGuestState, usePhotoSave } from "@/lib/hooks";
import type { GuestNominee } from "@/lib/types";

export default function EditPage() {
  const { category, id } = useParams<{ category: string; id: string }>();
  if (!isCategory(category)) notFound();
  return <EditScreen category={category} id={id} />;
}

// Edit a nominee: names, photo, and more categories (guests cannot remove one). Anyone can
// edit while voting is open.
function EditScreen({ category, id }: { category: CategorySlug; id: string }) {
  const router = useRouter();
  const back = `/c/${category}`;
  const { view, failed: stateFailed, refresh } = useGuestState();
  const open = canWrite(view);
  const photo = usePhotoSave();
  const [nominee, setNominee] = useState<GuestNominee | null | "missing" | "failed">(null);
  const [names, setNames] = useState({ personName: "", costumeName: "" });
  const [added, setAdded] = useState<CategorySlug[]>([]);

  // Loaded once, so a background refresh never overwrites what the guest is typing.
  useEffect(() => {
    fetchNominees(category)
      .then((lists) => {
        const n = lists.nominees.find((x) => x.id === id);
        setNominee(n ?? "missing");
        if (n) setNames({ personName: n.personName ?? "", costumeName: n.costumeName ?? "" });
      })
      .catch(() => setNominee("failed"));
  }, [category, id]);

  useEffect(() => {
    if (photo.error === "closed") refresh();
    if (photo.error === "not_found") setNominee("missing");
  }, [photo.error, refresh]);

  const busy = photo.stage !== null;

  async function save(n: GuestNominee) {
    const personName = cleanName(names.personName);
    const costumeName = cleanName(names.costumeName);
    const changed = personName !== n.personName || costumeName !== n.costumeName || photo.hasPhoto || added.length > 0;
    if (!changed) return router.push(back);
    const saved = await photo.run(async (photoPath) => {
      await editNominee({ nomineeId: n.id, personName, costumeName, photoPath, addCategories: added }).catch((err) => {
        if (err?.code !== "no_change") throw err;
      });
      return true;
    });
    if (saved) router.push(back);
  }

  return (
    <main className={PAGE}>
      <StatusBanner view={view} failed={stateFailed} onRetry={refresh} />
      <BackLink href={back}>← {categoryLabel(category)}</BackLink>
      <h1 className="mb-4 mt-2 font-title text-4xl text-pumpkin">Edit nominee</h1>
      {nominee === null && <p className="text-lg">Loading…</p>}
      {nominee === "failed" && <p className="text-lg">{GENERIC_ERROR}</p>}
      {nominee === "missing" && <p className="text-lg">{errorMessage("not_found")}</p>}
      {open && typeof nominee === "object" && nominee !== null && (
        <form
          className="space-y-6"
          onSubmit={(e) => {
            e.preventDefault();
            save(nominee);
          }}
        >
          <PhotoPicker
            cameraLabel="Replace photo"
            preview={photo.preview ?? nominee.photoUrl}
            disabled={busy}
            onPick={photo.pick}
          />
          <NameFields
            {...names}
            disabled={busy}
            onChange={(field, value) => setNames((prev) => ({ ...prev, [field]: value }))}
          />
          <CategoryChecks checked={added} locked={nominee.categories} disabled={busy} onChange={setAdded} />
          <div className="space-y-2">
            {(photo.pickError ?? photo.error) && (
              <p role="alert" className="text-lg font-semibold text-red-300">
                {errorMessage((photo.pickError ?? photo.error)!, view.kind === "opens_soon")}
              </p>
            )}
            {photo.stage && (
              <p role="status" className="text-lg text-violet-200">
                {photo.stage}
              </p>
            )}
            <button type="submit" disabled={busy || photo.pickError !== null} className={`${PRIMARY} w-full`}>
              {photo.error ? "Try again" : "Save changes"}
            </button>
          </div>
        </form>
      )}
    </main>
  );
}
