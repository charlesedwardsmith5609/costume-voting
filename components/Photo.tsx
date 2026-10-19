"use client";
import { useState } from "react";

// Square, cropped nominee photo. Shows the thumbnail and falls back to the full photo when the
// thumbnail is missing (older photos, or a thumbnail upload that failed). Remembers which
// thumbnail failed rather than the URL shown, so a replaced photo shows its new thumbnail.
export function photoSrc(thumbUrl: string | undefined, photoUrl: string, failedThumb: string | null): string {
  return thumbUrl && thumbUrl !== failedThumb ? thumbUrl : photoUrl;
}

export function Photo({ thumbUrl, photoUrl, alt }: { thumbUrl?: string; photoUrl: string; alt: string }) {
  const [failedThumb, setFailedThumb] = useState<string | null>(null);
  const src = photoSrc(thumbUrl, photoUrl, failedThumb);
  return (
    <img
      src={src}
      alt={alt}
      loading="lazy"
      decoding="async"
      onError={() => src === thumbUrl && setFailedThumb(thumbUrl)}
      className="aspect-square w-full bg-white/5 object-cover"
    />
  );
}
