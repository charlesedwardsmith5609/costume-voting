import { describe, expect, it } from "vitest";
import { checkPicked, checkPrepared, MAX_UPLOAD_BYTES, PHOTO_OPTIONS, THUMB_OPTIONS } from "@/lib/photo";

describe("photo preparation", () => {
  it("compresses to the spec's JPEG settings, without EXIF, on the page (no CDN worker)", () => {
    expect(PHOTO_OPTIONS).toMatchObject({
      maxWidthOrHeight: 1600,
      initialQuality: 0.8,
      maxSizeMB: 0.5,
      fileType: "image/jpeg",
      preserveExif: false,
      useWebWorker: false,
    });
    expect(THUMB_OPTIONS).toMatchObject({ maxWidthOrHeight: 600, fileType: "image/jpeg", preserveExif: false, useWebWorker: false });
  });

  it("refuses files that are not images; an empty type (some camera files) is allowed", () => {
    expect(checkPicked({ type: "application/pdf" })).toBe("not_image");
    expect(checkPicked({ type: "video/mp4" })).toBe("not_image");
    expect(checkPicked({ type: "image/heic" })).toBeNull();
    expect(checkPicked({ type: "" })).toBeNull();
  });

  it("refuses a compressed photo over 5 MB", () => {
    expect(checkPrepared({ size: MAX_UPLOAD_BYTES })).toBeNull();
    expect(checkPrepared({ size: MAX_UPLOAD_BYTES + 1 })).toBe("too_large");
  });
});
