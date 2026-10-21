// Validation for the status the TV page publishes. Bounds size so the shared row stays small.
import { REVEAL_STEPS, type RevealState } from "@/lib/revealRemote";

const isInt = (v: unknown, max: number): v is number => Number.isInteger(v) && (v as number) >= 0 && (v as number) <= max;
const isText = (v: unknown, max: number): v is string => typeof v === "string" && v.length <= max;

export function parseRevealState(v: unknown): RevealState | null {
  if (!v || typeof v !== "object") return null;
  const s = v as Record<string, unknown>;
  if (!REVEAL_STEPS.some((x) => x === s.step)) return null;
  if (!isInt(s.index, 50) || !isInt(s.count, 50)) return null;
  if (!(s.label === null || isText(s.label, 80))) return null;
  if (typeof s.revealed !== "boolean" || typeof s.rolling !== "boolean" || typeof s.muted !== "boolean") return null;
  if (!Array.isArray(s.winners) || s.winners.length > 10 || !s.winners.every((w) => isText(w, 160))) return null;
  return {
    step: s.step as RevealState["step"],
    index: s.index,
    count: s.count,
    label: s.label as string | null,
    revealed: s.revealed,
    rolling: s.rolling,
    muted: s.muted,
    winners: s.winners as string[],
  };
}
