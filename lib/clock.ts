// Voting status for guest screens (SPEC "Home screen"), computed from the server's timestamps and
// the phone's clock corrected by the measured offset, so a phone with a wrong clock still counts
// down to the real close. Same window rule as voting_is_open(): opens_at <= now < closes_at.
import type { GuestState } from "./types";

export const COUNTDOWN_MS = 15 * 60_000;

export type StatusView =
  | { kind: "loading" }
  | { kind: "opens_soon" }
  // now is the server time, to tell whether the close is on another day.
  | { kind: "open_until"; closesAt: Date; now: Date }
  | { kind: "countdown"; msLeft: number }
  | { kind: "closed" };

// How far the server clock is ahead of the phone's, measured at the request midpoint.
export function clockOffset(serverNow: string, sentAt: number, receivedAt: number): number {
  return Date.parse(serverNow) - (sentAt + receivedAt) / 2;
}

// nowMs is the server time: Date.now() + offset.
export function statusView(state: GuestState | null, nowMs: number): StatusView {
  if (!state) return { kind: "loading" };
  const opens = state.votingOpensAt ? Date.parse(state.votingOpensAt) : null;
  const closes = state.votingClosesAt ? Date.parse(state.votingClosesAt) : null;
  if (opens === null || closes === null || nowMs < opens) return { kind: "opens_soon" };
  const msLeft = closes - nowMs;
  if (msLeft <= 0) return { kind: "closed" };
  if (msLeft <= COUNTDOWN_MS) return { kind: "countdown", msLeft };
  return { kind: "open_until", closesAt: new Date(closes), now: new Date(nowMs) };
}

export function canWrite(view: StatusView): boolean {
  return view.kind === "open_until" || view.kind === "countdown";
}

// "12:34". Rounds up, so the display reaches 0:00 only when voting has closed.
export function formatCountdown(msLeft: number): string {
  const total = Math.max(0, Math.ceil(msLeft / 1000));
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, "0")}`;
}

// "10:30 PM" in the phone's locale and time zone.
export function formatTime(date: Date, locale?: string): string {
  return date.toLocaleTimeString(locale, { hour: "numeric", minute: "2-digit" });
}

// The close time for "Voting open until …": just the time when it is today, otherwise the date
// and time ("Sun, Oct 25, 1:00 AM"). Days are the phone's local days.
export function formatCloseTime(closesAt: Date, now: Date, locale?: string): string {
  if (closesAt.toDateString() === now.toDateString()) return formatTime(closesAt, locale);
  return closesAt.toLocaleString(locale, { weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
}
