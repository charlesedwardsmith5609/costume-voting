import { requireAdmin } from "@/lib/server/admin";
import { json, reject, serverError } from "@/lib/server/http";
import { parseRevealState } from "@/lib/server/revealRemote";
import { db } from "@/lib/server/supabase";
import { readBody } from "@/lib/server/validate";

// POST { state }. The TV page publishes what it is showing, for the phone remote.
// One update, so no function. Owner: reveal_remote (state, state_at).
export async function POST(req: Request): Promise<Response> {
  const denied = requireAdmin(req);
  if (denied) return denied;
  const body = await readBody(req);
  const state = parseRevealState(body?.state);
  if (!state) return reject("reveal-state", "invalid_request");
  const { error } = await db()
    .from("reveal_remote")
    .update({ state, state_at: new Date().toISOString() })
    .eq("id", 1);
  if (error) return serverError("reveal-state", error);
  return json({ ok: true });
}
