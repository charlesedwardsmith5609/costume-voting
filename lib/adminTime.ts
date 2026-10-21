// Close-time picker helpers for the admin timer. The picker is an <input type="datetime-local">,
// whose value ("2026-10-24T22:00") has no time zone; the server needs an absolute time, so it is
// sent with the host's UTC offset for that date ("2026-10-24T22:00:00-07:00").

// SPEC: the picker defaults to 10:00 PM on Saturday, October 24, 2026, host's local time.
export const DEFAULT_CLOSE = "2026-10-24T22:00";

const LOCAL = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/;

// The picker value as a local Date, or null if it is not a complete date and time.
export function parseLocal(value: string): Date | null {
  const m = LOCAL.exec(value);
  if (!m) return null;
  const [y, mo, d, h, mi] = m.slice(1).map(Number);
  const date = new Date(y, mo - 1, d, h, mi);
  return Number.isNaN(date.getTime()) ? null : date;
}

// offsetMinutes is east of UTC (-420 for Pacific daylight time), i.e. -Date.getTimezoneOffset().
export function withOffset(value: string, offsetMinutes: number): string {
  const sign = offsetMinutes < 0 ? "-" : "+";
  const abs = Math.abs(offsetMinutes);
  const hh = String(Math.floor(abs / 60)).padStart(2, "0");
  const mm = String(abs % 60).padStart(2, "0");
  return `${value}:00${sign}${hh}:${mm}`;
}

// The value to send, using the offset in effect on that date (handles daylight saving).
export function closesAtForServer(value: string): string | null {
  const date = parseLocal(value);
  return date ? withOffset(value, -date.getTimezoneOffset()) : null;
}

// The preset, or empty (so the host is asked to pick) once the preset has passed.
export function defaultClose(nowMs: number): string {
  const preset = parseLocal(DEFAULT_CLOSE);
  return preset && preset.getTime() > nowMs ? DEFAULT_CLOSE : "";
}

// Why the picked time can't be used, or null. The server checks "in the future" again.
export function closeTimeProblem(value: string, nowMs: number): string | null {
  const date = parseLocal(value);
  if (!date) return "Pick a closing time";
  if (date.getTime() <= nowMs) return "Pick a time in the future";
  return null;
}
