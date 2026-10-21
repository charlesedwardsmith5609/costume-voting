import { describe, expect, it } from "vitest";
import { MYSTERY_LABEL } from "@/lib/nomineeLabel";
import { slideshowDisplayLabel } from "@/lib/slideshowLabel";

describe("slideshowDisplayLabel", () => {
  it("keeps a real name", () => {
    expect(slideshowDisplayLabel("Sam as The Mad Hatter")).toBe("Sam as The Mad Hatter");
  });

  it("uses No name for unused and mystery photos", () => {
    expect(slideshowDisplayLabel(null)).toBe("No name");
    expect(slideshowDisplayLabel(MYSTERY_LABEL)).toBe("No name");
  });
});
