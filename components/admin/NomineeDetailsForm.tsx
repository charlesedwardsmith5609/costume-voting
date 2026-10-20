"use client";
import { useEffect, useState } from "react";
import { useAdmin } from "@/components/admin/AdminContext";
import { cleanName, NameFields } from "@/components/NameFields";
import { PhotoPicker } from "@/components/PhotoPicker";
import { PRIMARY } from "@/components/ui";
import { adminEditNominee, adminErrorMessage, adminUploadUrl, type AdminNominee } from "@/lib/adminApi";
import { errorMessage } from "@/lib/guestErrors";
import { usePhotoSave } from "@/lib/hooks";

// Host edit of names and photo, allowed at any time and on hidden nominees. The parent remounts
// this form (key) after a save, so the next edit starts from the saved values.
// Owner: admin_edit_nominee (nominees, nominee_edits); photo in Storage at host/<uuid>.jpg.
export function NomineeDetailsForm({ nominee, onSaved }: { nominee: AdminNominee; onSaved: () => void }) {
  const { expired } = useAdmin();
  const photo = usePhotoSave(adminUploadUrl);
  const [names, setNames] = useState({ personName: nominee.personName ?? "", costumeName: nominee.costumeName ?? "" });
  const [noChange, setNoChange] = useState(false);
  const busy = photo.stage !== null;

  async function save() {
    setNoChange(false);
    const personName = cleanName(names.personName);
    const costumeName = cleanName(names.costumeName);
    if (personName === nominee.personName && costumeName === nominee.costumeName && !photo.hasPhoto) return setNoChange(true);
    const ok = await photo.run(async (photoPath) => {
      await adminEditNominee({ nomineeId: nominee.id, personName, costumeName, photoPath }).catch((err) => {
        if (err?.code !== "no_change") throw err;
      });
      return true;
    });
    if (ok) onSaved();
  }

  useEffect(() => {
    if (photo.error === "unauthorized") expired();
  }, [photo.error, expired]);
  const problem = photo.pickError ? errorMessage(photo.pickError) : photo.error ? adminErrorMessage(photo.error) : null;

  return (
    <form
      className="space-y-6"
      onSubmit={(e) => {
        e.preventDefault();
        save();
      }}
    >
      <PhotoPicker cameraLabel="Replace photo" preview={photo.preview ?? nominee.photoUrl} disabled={busy} onPick={photo.pick} />
      <NameFields
        {...names}
        disabled={busy}
        onChange={(field, value) => {
          setNoChange(false);
          setNames((prev) => ({ ...prev, [field]: value }));
        }}
      />
      <div className="space-y-2">
        {problem && (
          <p role="alert" className="text-lg font-semibold text-red-300">
            {problem}
          </p>
        )}
        {photo.stage && (
          <p role="status" className="text-lg text-violet-200">
            {photo.stage}
          </p>
        )}
        {noChange && !problem && (
          <p role="status" className="text-lg text-violet-200">
            No changes to save.
          </p>
        )}
        <button type="submit" disabled={busy || photo.pickError !== null} className={`${PRIMARY} w-full`}>
          {photo.error ? "Try again" : "Save changes"}
        </button>
      </div>
    </form>
  );
}
