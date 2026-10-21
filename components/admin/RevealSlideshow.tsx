"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { useAdmin } from "@/components/admin/AdminContext";
import { ApiError } from "@/lib/api";
import { adminErrorMessage, fetchSlideshowPhotos, type SlideshowPhoto } from "@/lib/adminApi";
import { slideshowOrder } from "@/lib/reveal";

const SHOW_MS = 7000;

// Full-screen photo slideshow of the evening: every photo the host hasn't removed (hidden and
// unused ones too) in random order, reshuffled after each pass, until Exit or Escape. A photo
// that fails to load is skipped. Owner: nominees, nominee_edits, photo_uploads,
// slideshow_exclusions (read only).
export function RevealSlideshow({ onExit }: { onExit: () => void }) {
  const { expired } = useAdmin();
  const [photos, setPhotos] = useState<SlideshowPhoto[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [current, setCurrent] = useState<SlideshowPhoto | null>(null);
  const queue = useRef<SlideshowPhoto[]>([]);
  const last = useRef<string | null>(null);
  const broken = useRef(new Set<string>());

  useEffect(() => {
    fetchSlideshowPhotos()
      .then((r) => setPhotos(r.photos.filter((p) => !p.excluded)))
      .catch((err) => {
        const code = err instanceof ApiError ? err.code : "server_error";
        if (code === "unauthorized") return expired();
        setError(adminErrorMessage(code));
      });
  }, [expired]);

  const advance = useCallback(() => {
    if (!photos) return;
    const usable = photos.filter((p) => !broken.current.has(p.path));
    if (usable.length === 0) return setCurrent(null);
    let next = queue.current.shift();
    while (next && broken.current.has(next.path)) next = queue.current.shift();
    if (!next) {
      queue.current = slideshowOrder(usable, last.current);
      next = queue.current.shift()!;
    }
    last.current = next.path;
    setCurrent(next);
  }, [photos]);

  useEffect(() => {
    advance();
  }, [advance]);

  useEffect(() => {
    if (!current) return;
    const t = setTimeout(advance, SHOW_MS);
    return () => clearTimeout(t);
  }, [current, advance]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onExit();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onExit]);

  return (
    <div className="absolute inset-0 z-10 flex items-center justify-center overflow-hidden bg-black">
      {current && (
        <div key={current.path} className="rv-fade absolute inset-0">
          {/* Blurred copy fills the screen; the photo itself is shown whole on top. */}
          <img src={current.photoUrl} alt="" aria-hidden className="absolute inset-0 size-full scale-110 object-cover opacity-40 blur-2xl" />
          <img
            src={current.photoUrl}
            alt={current.label ?? "Party photo"}
            onError={() => {
              broken.current.add(current.path);
              advance();
            }}
            className="rv-kenburns absolute inset-0 size-full object-contain"
            style={{ ["--d" as string]: `${SHOW_MS / 1000 + 1}s` }}
          />
          {current.label && (
            <p className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 to-transparent px-[4vw] pb-[4vh] pt-[8vh] text-center text-[4vh] font-bold">
              {current.label}
            </p>
          )}
        </div>
      )}
      {!current && (
        <p className="text-center text-[3vh]">
          {error ?? (photos === null ? "Loading…" : "No photos to show. Add some on the Slideshow page.")}
        </p>
      )}
      <button
        type="button"
        onClick={onExit}
        className="absolute left-3 top-3 z-20 min-h-11 rounded-xl bg-black/50 px-4 text-violet-100 opacity-50 transition-opacity hover:opacity-100"
      >
        ← Exit slideshow
      </button>
    </div>
  );
}
