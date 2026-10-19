import { describe, expect, it } from "vitest";
import { thumbPath } from "@/lib/server/supabase";

describe("thumbPath", () => {
  it("puts the thumbnail next to the photo", () => {
    expect(thumbPath("guest/0b6c6f8e-2a39-4f5e-9d38-6f1b8f0e4a11.jpg")).toBe("guest/0b6c6f8e-2a39-4f5e-9d38-6f1b8f0e4a11.thumb.jpg");
    expect(thumbPath("host/0b6c6f8e-2a39-4f5e-9d38-6f1b8f0e4a11.jpg")).toBe("host/0b6c6f8e-2a39-4f5e-9d38-6f1b8f0e4a11.thumb.jpg");
  });
});
