import { describe, expect, it } from "vitest";
import { canWrite, clockOffset, COUNTDOWN_MS, formatCountdown, formatTime, statusView } from "@/lib/clock";
import type { GuestState } from "@/lib/types";

const OPENS = Date.parse("2026-10-24T19:00:00Z");
const CLOSES = Date.parse("2026-10-25T05:00:00Z");
const state = (opens: number | null, closes: number | null): GuestState => ({
  status: "open",
  votingOpensAt: opens === null ? null : new Date(opens).toISOString(),
  votingClosesAt: closes === null ? null : new Date(closes).toISOString(),
  resultsPublished: false,
  serverNow: new Date(OPENS).toISOString(),
});
const open = state(OPENS, CLOSES);

describe("statusView", () => {
  it("is loading until the first state arrives", () => {
    expect(statusView(null, OPENS)).toEqual({ kind: "loading" });
  });

  it("opens soon before the host starts voting", () => {
    expect(statusView(state(null, null), OPENS)).toEqual({ kind: "opens_soon" });
    expect(statusView(open, OPENS - 1)).toEqual({ kind: "opens_soon" });
  });

  it("is open until the close time, then counts down for the last 15 minutes", () => {
    expect(statusView(open, OPENS)).toEqual({ kind: "open_until", closesAt: new Date(CLOSES) });
    expect(statusView(open, CLOSES - COUNTDOWN_MS - 1).kind).toBe("open_until");
    expect(statusView(open, CLOSES - COUNTDOWN_MS)).toEqual({ kind: "countdown", msLeft: COUNTDOWN_MS });
    expect(statusView(open, CLOSES - 1)).toEqual({ kind: "countdown", msLeft: 1 });
  });

  it("is closed at the close time, like voting_is_open()", () => {
    expect(statusView(open, CLOSES)).toEqual({ kind: "closed" });
    expect(statusView(open, CLOSES + 60_000)).toEqual({ kind: "closed" });
  });

  it("only allows writes while open", () => {
    expect(canWrite({ kind: "open_until", closesAt: new Date(CLOSES) })).toBe(true);
    expect(canWrite({ kind: "countdown", msLeft: 5 })).toBe(true);
    for (const kind of ["loading", "opens_soon", "closed"] as const) expect(canWrite({ kind })).toBe(false);
  });
});

describe("clock offset", () => {
  it("corrects a phone clock that is minutes off, using the request midpoint", () => {
    // The phone is 7 minutes behind; the request took 400 ms.
    const behind = 7 * 60_000;
    const sentAt = CLOSES - 10 * 60_000 - behind;
    const serverNow = new Date(sentAt + behind + 200).toISOString();
    const offset = clockOffset(serverNow, sentAt, sentAt + 400);
    expect(offset).toBe(behind);
    // Without correction the phone would show 17 minutes left (no countdown yet).
    expect(statusView(open, sentAt + 400).kind).toBe("open_until");
    expect(statusView(open, sentAt + 400 + offset)).toEqual({ kind: "countdown", msLeft: 10 * 60_000 - 400 });
  });
});

describe("formatting", () => {
  it("shows minutes and seconds, rounding up so 0:00 means closed", () => {
    expect(formatCountdown(12 * 60_000 + 34_000)).toBe("12:34");
    expect(formatCountdown(15 * 60_000)).toBe("15:00");
    expect(formatCountdown(1)).toBe("0:01");
    expect(formatCountdown(0)).toBe("0:00");
    expect(formatCountdown(-5)).toBe("0:00");
  });

  it("shows the close time as hours and minutes", () => {
    const t = new Date(2026, 9, 24, 22, 30);
    expect(formatTime(t, "en-US")).toBe("10:30 PM");
  });
});
