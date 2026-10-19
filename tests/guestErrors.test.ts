import { describe, expect, it } from "vitest";
import { errorMessage, GENERIC_ERROR } from "@/lib/guestErrors";

describe("guest error copy", () => {
  it("has specific copy for every code a guest can hit", () => {
    const codes = ["rate_limited", "not_found", "invalid_nominee", "upload_failed", "not_image", "unreadable", "too_large", "no_photo", "no_category"];
    for (const code of codes) expect(errorMessage(code), code).not.toBe(GENERIC_ERROR);
    expect(errorMessage("upload_failed")).toBe("Upload failed. Check your connection and try again.");
    expect(errorMessage("rate_limited")).toBe("Slow down a little! Try again in a few minutes.");
  });

  it("says whether voting is closed or not started yet", () => {
    expect(errorMessage("closed")).toBe("Voting is closed");
    expect(errorMessage("closed", true)).toBe("Voting opens soon");
  });

  it("falls back to a friendly generic message", () => {
    expect(errorMessage("server_error")).toBe("Something went wrong. Try again.");
    expect(errorMessage("network")).toBe(GENERIC_ERROR);
  });
});
