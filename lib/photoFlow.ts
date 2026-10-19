// The add/edit photo steps: prepare (compress), get upload URLs, upload the photo, upload the
// thumbnail, save. `progress` remembers what already succeeded, so "Try again" resumes at the
// step that failed and never uploads the same file twice (a signed URL accepts one upload).
// A failed thumbnail is not an error: guest screens fall back to the full photo.
// A failed photo upload starts over with fresh URLs, since Storage may have kept the file (a lost
// response) or the URL may have expired, and either way the same URL can never succeed again.
import { ApiError, type IssuedUpload } from "./api";
import type { PreparedPhoto } from "./photo";

export type Stage = "preparing" | "uploading" | "saving";

export type FlowProgress = {
  prepared: PreparedPhoto | null;
  issued: IssuedUpload | null;
  photoUploaded: boolean;
  thumbTried: boolean;
  // A save failed without a clear answer (lost connection or server error), so it may have
  // committed.
  saveUncertain: boolean;
};

export const newProgress = (): FlowProgress => ({
  prepared: null,
  issued: null,
  photoUploaded: false,
  thumbTried: false,
  saveUncertain: false,
});

// Returned when a retry finds that an earlier, unanswered save already went through.
export const ALREADY_SAVED = "already_saved";

const freshUpload = (p: FlowProgress) => Object.assign(p, { issued: null, photoUploaded: false, thumbTried: false });

export type FlowDeps<T> = {
  prepare: () => Promise<PreparedPhoto>;
  issue: () => Promise<IssuedUpload>;
  put: (url: string, file: Blob, onProgress: (fraction: number) => void) => Promise<void>;
  save: (photoPath: string) => Promise<T>;
  onStage: (stage: Stage, fraction?: number) => void;
};

// code is a guest API error code, or one of: not_image, too_large, unreadable, upload_failed.
export class FlowError extends Error {
  constructor(
    public stage: Stage,
    public code: string,
  ) {
    super(code);
  }
}

const PREPARE_CODES = ["not_image", "too_large", "unreadable"];
const apiCode = (err: unknown) => (err instanceof ApiError ? err.code : "server_error");

export async function runPhotoFlow<T>(p: FlowProgress, deps: FlowDeps<T>): Promise<T | typeof ALREADY_SAVED> {
  if (!p.prepared) {
    deps.onStage("preparing");
    try {
      p.prepared = await deps.prepare();
    } catch (err) {
      const msg = err instanceof Error ? err.message : "";
      throw new FlowError("preparing", PREPARE_CODES.includes(msg) ? msg : "unreadable");
    }
  }
  const { photo, thumb } = p.prepared;

  if (!p.issued) {
    deps.onStage("uploading", 0);
    try {
      p.issued = await deps.issue();
    } catch (err) {
      const code = apiCode(err);
      throw new FlowError("uploading", code === "network" ? "upload_failed" : code);
    }
  }
  const issued = p.issued;

  if (!p.photoUploaded) {
    deps.onStage("uploading", 0);
    try {
      await deps.put(issued.signedUrl, photo, (f) => deps.onStage("uploading", f));
    } catch {
      freshUpload(p);
      throw new FlowError("uploading", "upload_failed");
    }
    p.photoUploaded = true;
  }

  if (!p.thumbTried) {
    try {
      await deps.put(issued.thumbSignedUrl, thumb, () => {});
    } catch {
      // Grids show the full photo instead.
    }
    p.thumbTried = true;
  }

  deps.onStage("saving");
  try {
    return await deps.save(issued.path);
  } catch (err) {
    const code = apiCode(err);
    if (code === "invalid_photo") {
      // Only this device can use the path, so after an unanswered save, "already used" means
      // that save went through. Starting over would create a duplicate.
      if (p.saveUncertain) return ALREADY_SAVED;
      // Otherwise the server did not accept the upload; the next try starts with fresh URLs.
      freshUpload(p);
      throw new FlowError("saving", "upload_failed");
    }
    if (code === "network" || code === "server_error") p.saveUncertain = true;
    throw new FlowError("saving", code);
  }
}
