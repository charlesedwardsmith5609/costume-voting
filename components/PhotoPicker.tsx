"use client";
import { SECONDARY } from "./ui";

// One button opens the camera on phones; the other opens the photo library (SPEC "Add a
// nominee"). Each is a label wrapping a hidden file input, which works on iOS Safari.
export function PhotoPicker({
  cameraLabel,
  preview,
  disabled,
  onPick,
}: {
  cameraLabel: string;
  preview: string | null;
  disabled: boolean;
  onPick: (file: File) => void;
}) {
  const input = (capture: boolean) => (
    <input
      type="file"
      accept="image/*"
      {...(capture ? { capture: "environment" as const } : {})}
      disabled={disabled}
      className="sr-only"
      onChange={(e) => {
        const file = e.target.files?.[0];
        e.target.value = "";
        if (file) onPick(file);
      }}
    />
  );
  return (
    <div className="space-y-3">
      {preview && <img src={preview} alt="" className="aspect-square w-full rounded-2xl object-cover" />}
      <div className="grid grid-cols-2 gap-3">
        <label className={`${SECONDARY} cursor-pointer text-base`}>
          {cameraLabel}
          {input(true)}
        </label>
        <label className={`${SECONDARY} cursor-pointer text-base`}>
          Choose from library
          {input(false)}
        </label>
      </div>
    </div>
  );
}
