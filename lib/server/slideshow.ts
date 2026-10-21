// Every photo the final slideshow can show, with where it came from. Pure: the admin photos
// route loads the rows and Storage listing, and passes them in.
import { singleLine } from "../nomineeLabel";

export type SlideshowSource = "current" | "hidden" | "earlier" | "unused";

export type SlideshowPhoto = {
  path: string;
  label: string | null; // null for an unused upload
  source: SlideshowSource;
  excluded: boolean;
};

type NomineeRow = { id: string; person_name: string | null; costume_name: string | null; photo_path: string; hidden: boolean };
type EditRow = { nominee_id: string; old_photo_path: string; new_photo_path: string };

// A photo appears once, as its most specific source: a nominee's current photo (visible or
// hidden), then a photo an edit replaced, then an upload nothing uses.
export function buildSlideshowPhotos(input: {
  nominees: NomineeRow[];
  edits: EditRow[];
  uploadPaths: string[];
  excluded: Set<string>;
}): SlideshowPhoto[] {
  const seen = new Set<string>();
  const out: SlideshowPhoto[] = [];
  const add = (path: string, label: string | null, source: SlideshowSource) => {
    if (seen.has(path)) return;
    seen.add(path);
    out.push({ path, label, source, excluded: input.excluded.has(path) });
  };
  const labels = new Map<string, string>();
  for (const n of input.nominees) {
    const label = singleLine({ personName: n.person_name, costumeName: n.costume_name });
    labels.set(n.id, label);
    add(n.photo_path, label, n.hidden ? "hidden" : "current");
  }
  for (const e of input.edits) {
    const label = labels.get(e.nominee_id) ?? null;
    add(e.old_photo_path, label, "earlier");
    add(e.new_photo_path, label, "earlier");
  }
  for (const p of input.uploadPaths) add(p, null, "unused");
  return out;
}
