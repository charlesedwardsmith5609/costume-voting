"use client";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { BackLink } from "@/components/BackLink";
import { CategoryChecks } from "@/components/CategoryChecks";
import { cleanName, NameFields } from "@/components/NameFields";
import { NomineeStrip } from "@/components/NomineeStrip";
import { PhotoPicker } from "@/components/PhotoPicker";
import { StatusBanner } from "@/components/StatusBanner";
import { PAGE, PRIMARY } from "@/components/ui";
import { addToCategories, ApiError, fetchNominees, nominate, type NomineeLists } from "@/lib/api";
import { canWrite } from "@/lib/clock";
import { categoryLabel, type CategorySlug } from "@/lib/categories";
import { errorMessage } from "@/lib/guestErrors";
import { useGuestState, usePhotoSave } from "@/lib/hooks";
import { singleLine } from "@/lib/nomineeLabel";
import type { GuestNominee } from "@/lib/types";

const MATCH_DELAY_MS = 300;

type Props = {
  // From a category screen: that category is pre-checked and "Already nominated?" is shown.
  // From "Nominate a costume" (null): nothing is pre-checked and there is no duplicate check,
  // since the guest just looked through every nominee.
  category: CategorySlug | null;
  back: { href: string; label: string };
  // Where to go after saving.
  done: string;
};

// Add a nominee: photo, optional names, categories, and (from a category) "Already nominated?"
// to avoid duplicates.
export function NominateForm({ category, back, done }: Props) {
  const router = useRouter();
  const { view, failed: stateFailed, refresh } = useGuestState();
  const open = canWrite(view);
  const photo = usePhotoSave();
  const [names, setNames] = useState({ personName: "", costumeName: "" });
  const [categories, setCategories] = useState<CategorySlug[]>(category ? [category] : []);
  const [formError, setFormError] = useState<string | null>(null);
  const [lists, setLists] = useState<NomineeLists | null>(null);
  const [adding, setAdding] = useState(false);
  const [addError, setAddError] = useState<string | null>(null);
  const busy = photo.stage !== null || adding;

  // Strips and name matches, refreshed shortly after typing stops.
  useEffect(() => {
    if (!category) return;
    const queries = [names.personName, names.costumeName].map((s) => s.trim()).filter((s) => s.length >= 2);
    const timer = setTimeout(() => {
      fetchNominees(category, queries).then(setLists).catch(() => {});
    }, MATCH_DELAY_MS);
    return () => clearTimeout(timer);
  }, [category, names.personName, names.costumeName]);

  useEffect(() => {
    if (photo.error === "closed") refresh();
  }, [photo.error, refresh]);

  async function submit() {
    setFormError(null);
    if (!photo.hasPhoto) return setFormError("no_photo");
    if (categories.length === 0) return setFormError("no_category");
    const saved = await photo.run((photoPath) =>
      nominate({
        categories,
        personName: cleanName(names.personName),
        costumeName: cleanName(names.costumeName),
        photoPath: photoPath!,
      }),
    );
    if (saved) router.push(done);
  }

  async function addExisting(n: GuestNominee, here: CategorySlug) {
    setAdding(true);
    setAddError(null);
    try {
      await addToCategories(n.id, [here]);
      router.push(done);
    } catch (err) {
      const code = err instanceof ApiError ? err.code : "server_error";
      if (code === "already_in_category") return router.push(done);
      if (code === "closed") refresh();
      setAddError(errorMessage(code, view.kind === "opens_soon"));
      setAdding(false);
    }
  }

  // Shown errors: a picked-photo problem, a form check, or the last save attempt.
  const shownError = photo.pickError ?? formError ?? photo.error;

  return (
    <main className={PAGE}>
      <StatusBanner view={view} failed={stateFailed} onRetry={refresh} />
      <BackLink href={back.href}>← {back.label}</BackLink>
      <h1 className="mb-4 mt-2 font-title text-4xl text-pumpkin">Add a nominee</h1>
      {open && (
        <form
          className="space-y-6"
          onSubmit={(e) => {
            e.preventDefault();
            submit();
          }}
        >
          <PhotoPicker cameraLabel="Take photo" preview={photo.preview} disabled={busy} onPick={photo.pick} />
          <NameFields
            {...names}
            disabled={busy}
            onChange={(field, value) => setNames((prev) => ({ ...prev, [field]: value }))}
          />

          {category && (
            <AlreadyNominated
              category={category}
              lists={lists}
              disabled={busy || !open}
              error={addError}
              onAdd={(n) => addExisting(n, category)}
            />
          )}

          <CategoryChecks checked={categories} disabled={busy} onChange={setCategories} />

          <div className="space-y-2">
            {shownError && (
              <p role="alert" className="text-lg font-semibold text-red-300">
                {errorMessage(shownError, view.kind === "opens_soon")}
              </p>
            )}
            {photo.stage && (
              <p role="status" className="text-lg text-violet-200">
                {photo.stage}
              </p>
            )}
            <button type="submit" disabled={busy || photo.pickError !== null} className={`${PRIMARY} w-full`}>
              {photo.error ? "Try again" : "Add nominee"}
            </button>
          </div>
        </form>
      )}
    </main>
  );
}

function AlreadyNominated({
  category,
  lists,
  disabled,
  error,
  onAdd,
}: {
  category: CategorySlug;
  lists: NomineeLists | null;
  disabled: boolean;
  error: string | null;
  onAdd: (n: GuestNominee) => void;
}) {
  const here = categoryLabel(category);
  const addHere = { label: () => "Add to this category", onClick: onAdd, disabled };
  const addMatch = { label: (n: GuestNominee) => `Add ${singleLine(n)} to ${here}`, onClick: onAdd, disabled };
  return (
    <section className="space-y-3">
      <h2 className="text-xl font-bold">Already nominated?</h2>
      {lists?.matches && (
        <>
          <NomineeStrip nominees={lists.matches.here} />
          <NomineeStrip nominees={lists.matches.elsewhere} action={addMatch} />
        </>
      )}
      <NomineeStrip nominees={lists?.strips.here ?? []} />
      <NomineeStrip title="Already nominated elsewhere" nominees={lists?.strips.elsewhere ?? []} action={addHere} />
      {error && <p className="text-lg text-red-300">{error}</p>}
    </section>
  );
}
