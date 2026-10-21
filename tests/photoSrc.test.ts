import { describe, expect, it } from "vitest";
import { photoSrc } from "@/components/Photo";

describe("photoSrc", () => {
  it("shows the thumbnail, or the full photo once that thumbnail failed", () => {
    expect(photoSrc("a.thumb.jpg", "a.jpg", null)).toBe("a.thumb.jpg");
    expect(photoSrc("a.thumb.jpg", "a.jpg", "a.thumb.jpg")).toBe("a.jpg");
    expect(photoSrc(undefined, "a.jpg", null)).toBe("a.jpg");
  });

  it("shows a replaced photo's new thumbnail even after the old one failed", () => {
    expect(photoSrc("b.thumb.jpg", "b.jpg", "a.thumb.jpg")).toBe("b.thumb.jpg");
  });
});
