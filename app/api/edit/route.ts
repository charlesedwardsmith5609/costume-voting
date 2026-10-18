import { readDevice } from "@/lib/server/device";
import { json, reject, serverError } from "@/lib/server/http";
import { db } from "@/lib/server/supabase";
import { INVALID, isUuid, parseCategories, parseName, parsePhotoPath, readBody } from "@/lib/server/validate";

// POST { nomineeId, personName, costumeName, photoPath?, addCategories? }. Both names are
// required keys (null for blank), since the edit sets both; a missing key would clear a name.
// Guests can add categories but not remove them.
// Owner: edit_nominee (nominees, nominee_categories, nominee_edits, rate_limits 'edit').
export async function POST(req: Request): Promise<Response> {
  const device = readDevice(req);
  if (!device) return reject("edit", "invalid_device");
  const body = await readBody(req);
  if (!body || !isUuid(body.nomineeId) || !("personName" in body) || !("costumeName" in body)) {
    return reject("edit", "invalid_request");
  }
  const personName = parseName(body.personName);
  const costumeName = parseName(body.costumeName);
  if (personName === INVALID || costumeName === INVALID) return reject("edit", "invalid_name");
  const photoPath = body.photoPath == null ? null : parsePhotoPath(body.photoPath);
  if (photoPath === INVALID) return reject("edit", "invalid_photo");
  const addCategories = parseCategories(body.addCategories ?? []);
  if (addCategories === INVALID) return reject("edit", "invalid_category");

  const { data, error } = await db().rpc("edit_nominee", {
    p_device: device,
    p_nominee: body.nomineeId,
    p_person_name: personName,
    p_costume_name: costumeName,
    p_photo_path: photoPath,
    p_add_categories: addCategories,
  });
  if (error) return serverError("edit", error);
  return data.status === "ok" ? json({ ok: true }) : reject("edit", data.status);
}
