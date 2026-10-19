import { requireAdmin } from "@/lib/server/admin";
import { json, reject, serverError } from "@/lib/server/http";
import { db } from "@/lib/server/supabase";
import { isUuid, readBody } from "@/lib/server/validate";

// POST { nomineeId }. Deletes the nominee; its categories, votes, and edit history cascade.
// Its photos stay in Storage (Reset removes them). Owner: nominees.
export async function POST(req: Request): Promise<Response> {
  const denied = requireAdmin(req);
  if (denied) return denied;
  const body = await readBody(req);
  if (!body || !isUuid(body.nomineeId)) return reject("delete", "invalid_request");

  const { data, error } = await db().from("nominees").delete().eq("id", body.nomineeId).select("id");
  if (error) return serverError("delete", error);
  return data.length === 1 ? json({ ok: true }) : reject("delete", "not_found");
}
