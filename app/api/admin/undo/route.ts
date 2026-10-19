import { requireAdmin } from "@/lib/server/admin";
import { json, reject, serverError } from "@/lib/server/http";
import { db } from "@/lib/server/supabase";
import { readBody } from "@/lib/server/validate";

// POST { editId }. Reverses one edit; the undo is logged as a host edit and can be undone.
// Owner: undo_nominee_edit (nominees, nominee_categories, votes, nominee_edits).
export async function POST(req: Request): Promise<Response> {
  const denied = requireAdmin(req);
  if (denied) return denied;
  const body = await readBody(req);
  if (!body || !Number.isSafeInteger(body.editId) || (body.editId as number) < 1) {
    return reject("undo", "invalid_request");
  }

  const { data, error } = await db().rpc("undo_nominee_edit", { p_edit_id: body.editId });
  if (error) return serverError("undo", error);
  return data.status === "ok" ? json({ ok: true }) : reject("undo", data.status);
}
