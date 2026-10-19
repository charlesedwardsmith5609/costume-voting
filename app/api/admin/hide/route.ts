import { requireAdmin } from "@/lib/server/admin";
import { json, reject, serverError } from "@/lib/server/http";
import { db } from "@/lib/server/supabase";
import { isUuid, readBody } from "@/lib/server/validate";

// POST { nomineeId, hidden }. Hiding removes the nominee from every category for guests and
// from results; its votes stay and come back if it is unhidden. Owner: nominees.hidden.
export async function POST(req: Request): Promise<Response> {
  const denied = requireAdmin(req);
  if (denied) return denied;
  const body = await readBody(req);
  if (!body || !isUuid(body.nomineeId) || typeof body.hidden !== "boolean") return reject("hide", "invalid_request");

  const { data, error } = await db().from("nominees").update({ hidden: body.hidden }).eq("id", body.nomineeId).select("id");
  if (error) return serverError("hide", error);
  return data.length === 1 ? json({ ok: true }) : reject("hide", "not_found");
}
