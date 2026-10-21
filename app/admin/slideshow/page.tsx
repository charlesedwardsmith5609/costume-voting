"use client";
import { useCallback, useState } from "react";
import { useAdmin } from "@/components/admin/AdminContext";
import { SlideshowPhotoCard } from "@/components/admin/SlideshowPhotoCard";
import { ADMIN_PAGE } from "@/components/admin/ui";
import { ApiError } from "@/lib/api";
import {
  adminErrorMessage,
  fetchSlideshowPhotos,
  setSlideshowExcluded,
  type SlideshowPhoto,
  type SlideshowSource,
} from "@/lib/adminApi";
import { useOnVisible } from "@/lib/hooks";

type Filter = "all" | SlideshowSource | "excluded";
const FILTERS: [Filter, string][] = [
  ["all", "All"],
  ["current", "Current"],
  ["hidden", "Hidden"],
  ["earlier", "Earlier"],
  ["unused", "Unused"],
  ["excluded", "Excluded"],
];

// Host removes or restores photos for the final slideshow. Owner: slideshow_exclusions
// (via POST /api/admin/slideshow-exclude); list from GET /api/admin/photos.
export default function AdminSlideshowPage() {
  const { expired } = useAdmin();
  const [photos, setPhotos] = useState<SlideshowPhoto[] | null>(null);
  const [filter, setFilter] = useState<Filter>("all");
  const [busyPath, setBusyPath] = useState<string | null>(null);
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
    fetchSlideshowPhotos()
      .then((r) => setPhotos(r.photos))
      .catch(fail);
  }, [fail]);
  useOnVisible(load);

  async function toggle(photo: SlideshowPhoto) {
    setBusyPath(photo.path);
    setError(null);
    try {
      await setSlideshowExcluded(photo.path, !photo.excluded);
    } catch (err) {
      fail(err);
    } finally {
      setBusyPath(null);
      load();
    }
  }

  const all = photos ?? [];
  const counts: Record<Filter, number> = {
    all: all.length,
    current: all.filter((p) => p.source === "current").length,
    hidden: all.filter((p) => p.source === "hidden").length,
    earlier: all.filter((p) => p.source === "earlier").length,
    unused: all.filter((p) => p.source === "unused").length,
    excluded: all.filter((p) => p.excluded).length,
  };
  const shown =
    filter === "all"
      ? all
      : filter === "excluded"
        ? all.filter((p) => p.excluded)
        : all.filter((p) => p.source === filter);

  return (
    <main className={ADMIN_PAGE}>
      <h1 className="mb-2 mt-2 font-title text-4xl text-pumpkin">Slideshow</h1>
      <p className="mb-4 text-lg text-violet-200">
        Remove photos you do not want in the final slideshow. Removed photos stay dimmed here and can be restored.
      </p>
      {error && (
        <p role="alert" className="mb-4 text-lg font-semibold text-red-300">
          {error}
        </p>
      )}
      {photos === null ? (
        !error && <p className="text-lg">Loading…</p>
      ) : (
        <div className="space-y-4">
          <div className="flex flex-wrap gap-2" role="group" aria-label="Show">
            {FILTERS.map(([value, label]) => (
              <button
                key={value}
                type="button"
                aria-pressed={filter === value}
                onClick={() => setFilter(value)}
                className={`min-h-11 flex-1 rounded-xl px-3 font-semibold ring-1 sm:flex-none ${
                  filter === value ? "bg-witch/30 ring-witch" : "bg-white/5 ring-white/15"
                }`}
              >
                {label} ({counts[value]})
              </button>
            ))}
          </div>
          {shown.length === 0 ? (
            <p className="text-lg text-violet-200">{all.length === 0 ? "No photos yet" : "No matches"}</p>
          ) : (
            <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              {shown.map((p) => (
                <SlideshowPhotoCard
                  key={p.path}
                  photo={p}
                  busy={busyPath === p.path}
                  onToggle={() => toggle(p)}
                />
              ))}
            </ul>
          )}
        </div>
      )}
    </main>
  );
}
