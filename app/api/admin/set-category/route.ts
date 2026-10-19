import { isCategory } from "@/lib/categories";
import { requireAdmin } from "@/lib/server/admin";
import { json, reject, serverError } from "@/lib/server/http";
import { db } from "@/lib/server/supabase";
import { isUuid, readBody } from "@/lib/server/validate";

// POST { nomineeId, category, present }. Adds or removes one category. Removing deletes only
// that category's votes for the nominee; the last category cannot be removed.
// Owner: admin_set_category (nominee_categories, votes, nominee_edits).
export async function POST(req: Request): Promise<Response> {
  const denied = requireAdmin(req);
  if (denied) return denied;
  const body = await readBody(req);
  if (!body || !isUuid(body.nomineeId) || typeof body.present !== "boolean") {
    return reject("set-category", "invalid_request");
  }
  if (!isCategory(body.category)) return reject("set-category", "invalid_category");

  const { data, error } = await db().rpc("admin_set_category", {
    p_nominee: body.nomineeId,
    p_category: body.category,
    p_present: body.present,
  });
  if (error) return serverError("set-category", error);
  return data.status === "ok" ? json({ ok: true }) : reject("set-category", data.status);
}
