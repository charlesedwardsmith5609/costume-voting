import { requireAdmin } from "@/lib/server/admin";
import { json, reject, serverError } from "@/lib/server/http";
import { db } from "@/lib/server/supabase";
import { isUuid, readBody } from "@/lib/server/validate";

// POST { keepId, dropId }. The kept nominee keeps its names and photo, gains the other's
// categories, and receives its votes; a device that voted for both keeps one vote per category.
// Owner: merge_nominees (nominees, nominee_categories, votes).
export async function POST(req: Request): Promise<Response> {
  const denied = requireAdmin(req);
  if (denied) return denied;
  const body = await readBody(req);
  if (!body || !isUuid(body.keepId) || !isUuid(body.dropId)) return reject("merge", "invalid_request");

  const { data, error } = await db().rpc("merge_nominees", { p_keep: body.keepId, p_drop: body.dropId });
  if (error) return serverError("merge", error);
  return data.status === "ok" ? json({ ok: true }) : reject("merge", data.status);
}
