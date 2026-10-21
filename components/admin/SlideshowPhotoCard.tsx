import { Photo } from "@/components/Photo";
import type { SlideshowPhoto, SlideshowSource } from "@/lib/adminApi";
import { slideshowDisplayLabel } from "@/lib/slideshowLabel";

const SOURCE_BADGE: Record<SlideshowSource, string> = {
  current: "Current",
  hidden: "Hidden",
  earlier: "Earlier photo",
  unused: "Unused",
};

const SMALL =
  "inline-flex min-h-11 w-full items-center justify-center rounded-xl px-4 font-bold disabled:opacity-50";

// One photo in the slideshow management grid: thumb, label, source badge, Remove/Restore.
export function SlideshowPhotoCard({
  photo,
  busy,
  onToggle,
}: {
  photo: SlideshowPhoto;
  busy: boolean;
  onToggle: () => void;
}) {
  const name = slideshowDisplayLabel(photo.label);
  return (
    <li
      className={`flex flex-col overflow-hidden rounded-xl ${
        photo.excluded ? "bg-white/[.03] opacity-50" : "bg-white/5"
      }`}
    >
      <div className="overflow-hidden">
        <Photo thumbUrl={photo.thumbUrl} photoUrl={photo.photoUrl} alt={name} />
      </div>
      <div className="flex flex-1 flex-col gap-2 p-3">
        <p className="truncate text-lg font-semibold">{name}</p>
        <p>
          <span className="rounded bg-zinc-700 px-1.5 py-0.5 text-sm text-zinc-200">{SOURCE_BADGE[photo.source]}</span>
        </p>
        <button
          type="button"
          disabled={busy}
          onClick={onToggle}
          className={
            photo.excluded
              ? `${SMALL} bg-witch/25 ring-1 ring-witch/60`
              : `${SMALL} bg-red-950 text-red-200 ring-1 ring-red-400/50`
          }
        >
          {photo.excluded ? "Restore" : "Remove"}
        </button>
      </div>
    </li>
  );
}
