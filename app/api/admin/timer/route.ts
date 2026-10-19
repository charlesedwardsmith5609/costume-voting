import { requireAdmin } from "@/lib/server/admin";
import { json, reject, serverError } from "@/lib/server/http";
import { db } from "@/lib/server/supabase";
import { readBody } from "@/lib/server/validate";

// An absolute time with an explicit offset, e.g. 2026-10-24T22:00:00-07:00, so the server never
// guesses the host's time zone.
const ISO_WITH_OFFSET = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2}(\.\d{1,6})?)?(Z|[+-]\d{2}:\d{2})$/;

// POST { action: "start", minutes } | { action: "start", closesAt } | { action: "extend", minutes }
// | { action: "end" }. "start" also reopens after close. Owner: set_timer (settings).
export async function POST(req: Request): Promise<Response> {
  const denied = requireAdmin(req);
  if (denied) return denied;
  const body = await readBody(req);
  if (!body) return reject("timer", "invalid_request");

  const { action, minutes, closesAt } = body;
  const args: Record<string, unknown> = { p_action: action };
  if (action === "start" && closesAt !== undefined) {
    if (minutes !== undefined || typeof closesAt !== "string" || !ISO_WITH_OFFSET.test(closesAt)) {
      return reject("timer", "invalid_timer");
    }
    const ms = Date.parse(closesAt);
    if (Number.isNaN(ms)) return reject("timer", "invalid_timer");
    args.p_closes_at = new Date(ms).toISOString();
  } else if (action === "start" || action === "extend") {
    if (!Number.isInteger(minutes)) return reject("timer", "invalid_timer");
    args.p_minutes = minutes;
  } else if (action !== "end") {
    return reject("timer", "invalid_timer");
  }

  const { data, error } = await db().rpc("set_timer", args);
  if (error) return serverError("timer", error);
  if (data.status === "invalid") return reject("timer", "invalid_timer");
  if (data.status !== "ok") return reject("timer", data.status);
  return json({ votingOpensAt: data.voting_opens_at, votingClosesAt: data.voting_closes_at });
}
