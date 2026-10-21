import { describe, expect, it } from "vitest";
import { closesAtForServer, closeTimeProblem, DEFAULT_CLOSE, defaultClose, parseLocal, withOffset } from "@/lib/adminTime";

describe("close-time picker", () => {
  it("adds the host's UTC offset to the picked local time", () => {
    expect(withOffset("2026-10-24T22:00", -420)).toBe("2026-10-24T22:00:00-07:00");
    expect(withOffset("2026-10-24T22:00", 330)).toBe("2026-10-24T22:00:00+05:30");
    expect(withOffset("2026-10-24T22:00", 0)).toBe("2026-10-24T22:00:00+00:00");
  });

  it("sends the same instant the host picked, in the server's accepted format", () => {
    const sent = closesAtForServer(DEFAULT_CLOSE)!;
    expect(sent).toMatch(/^2026-10-24T22:00:00[+-]\d{2}:\d{2}$/);
    expect(Date.parse(sent)).toBe(new Date(2026, 9, 24, 22, 0).getTime());
    expect(closesAtForServer("")).toBeNull();
  });

  it("presets 10:00 PM on Sat 10/24, and asks for a time once that has passed", () => {
    const preset = new Date(2026, 9, 24, 22, 0).getTime();
    expect(defaultClose(preset - 60_000)).toBe(DEFAULT_CLOSE);
    expect(defaultClose(preset)).toBe("");
  });

  it("accepts any future time with no upper limit", () => {
    const now = new Date(2026, 9, 24, 19, 0).getTime();
    expect(closeTimeProblem("", now)).toBe("Pick a closing time");
    expect(closeTimeProblem("2026-10-24", now)).toBe("Pick a closing time");
    expect(closeTimeProblem("2026-10-24T18:59", now)).toBe("Pick a time in the future");
    expect(closeTimeProblem("2026-10-24T19:00", now)).toBe("Pick a time in the future");
    expect(closeTimeProblem("2026-10-26T09:00", now)).toBeNull();
    expect(parseLocal("2026-10-26T09:00")?.getHours()).toBe(9);
  });
});
