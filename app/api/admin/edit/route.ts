import { requireAdmin } from "@/lib/server/admin";
import { json, reject, serverError } from "@/lib/server/http";
import { db } from "@/lib/server/supabase";
import { INVALID, isUuid, parseCategories, parseName, parsePhotoPath, readBody } from "@/lib/server/validate";

// POST { nomineeId, personName, costumeName, photoPath?, addCategories? }. Host edit, allowed at
// any time and on hidden nominees. Both name keys are required, as for guests. A new photo must
// come from /api/admin/upload-url. Owner: admin_edit_nominee (nominees, nominee_edits).
export async function POST(req: Request): Promise<Response> {
  const denied = requireAdmin(req);
  if (denied) return denied;
  const body = await readBody(req);
  if (!body || !isUuid(body.nomineeId) || !("personName" in body) || !("costumeName" in body)) {
    return reject("admin-edit", "invalid_request");
  }
  const personName = parseName(body.personName);
  const costumeName = parseName(body.costumeName);
  if (personName === INVALID || costumeName === INVALID) return reject("admin-edit", "invalid_name");
  const photoPath = body.photoPath == null ? null : parsePhotoPath(body.photoPath);
  if (photoPath === INVALID) return reject("admin-edit", "invalid_photo");
  const addCategories = parseCategories(body.addCategories ?? []);
  if (addCategories === INVALID) return reject("admin-edit", "invalid_category");

  const { data, error } = await db().rpc("admin_edit_nominee", {
    p_nominee: body.nomineeId,
    p_person_name: personName,
    p_costume_name: costumeName,
    p_photo_path: photoPath,
    p_add_categories: addCategories,
  });
  if (error) return serverError("admin-edit", error);
  return data.status === "ok" ? json({ ok: true }) : reject("admin-edit", data.status);
}
