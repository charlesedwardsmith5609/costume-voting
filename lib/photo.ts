// Photo preparation on the phone (SPEC "Add a nominee"): JPEG, at most 1600 px on the long side,
// quality about 0.8, target under 500 KB, plus a 600 px thumbnail for grids and strips. Drawing
// to a canvas applies the EXIF orientation and drops all EXIF data, including GPS.
import type { Options } from "browser-image-compression";

// The library's web worker loads its script from a CDN, so compress on the page instead.
const COMMON: Options = { fileType: "image/jpeg", useWebWorker: false, preserveExif: false };
export const PHOTO_OPTIONS: Options = { ...COMMON, maxWidthOrHeight: 1600, initialQuality: 0.8, maxSizeMB: 0.5 };
export const THUMB_OPTIONS: Options = { ...COMMON, maxWidthOrHeight: 600, initialQuality: 0.7, maxSizeMB: 0.08 };

// The bucket's limit; the server rejects anything larger.
export const MAX_UPLOAD_BYTES = 5 * 1024 * 1024;

export type PhotoProblem = "not_image" | "too_large";

// Some phones report an empty type for camera files, so only a known non-image type is refused.
export function checkPicked(file: { type: string }): PhotoProblem | null {
  return file.type && !file.type.startsWith("image/") ? "not_image" : null;
}

export function checkPrepared(photo: { size: number }): PhotoProblem | null {
  return photo.size > MAX_UPLOAD_BYTES ? "too_large" : null;
}

export type PreparedPhoto = { photo: Blob; thumb: Blob };

// Throws "unreadable" when the browser cannot decode the file (for example HEIC outside Safari).
export async function preparePhoto(file: File): Promise<PreparedPhoto> {
  const { default: compress } = await import("browser-image-compression");
  let photo: File;
  let thumb: File;
  try {
    photo = await compress(file, PHOTO_OPTIONS);
    thumb = await compress(photo, THUMB_OPTIONS);
  } catch {
    throw new Error("unreadable");
  }
  const problem = checkPrepared(photo);
  if (problem) throw new Error(problem);
  return { photo, thumb };
}
