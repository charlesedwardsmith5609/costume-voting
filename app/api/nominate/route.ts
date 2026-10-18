import { readDevice } from "@/lib/server/device";
import { json, reject, serverError } from "@/lib/server/http";
import { db } from "@/lib/server/supabase";
import { INVALID, parseCategories, parseName, parsePhotoPath, readBody } from "@/lib/server/validate";

// POST { categories, personName, costumeName, photoPath } -> 201 { id }.
// Owner: create_nominee (nominees, nominee_categories, rate_limits).
export async function POST(req: Request): Promise<Response> {
  const device = readDevice(req);
  if (!device) return reject("nominate", "invalid_device");
  const body = await readBody(req);
  if (!body) return reject("nominate", "invalid_request");
  const categories = parseCategories(body.categories);
  if (categories === INVALID || categories.length === 0) return reject("nominate", "invalid_category");
  const personName = parseName(body.personName ?? null);
  const costumeName = parseName(body.costumeName ?? null);
  if (personName === INVALID || costumeName === INVALID) return reject("nominate", "invalid_name");
  const photoPath = parsePhotoPath(body.photoPath);
  if (photoPath === INVALID) return reject("nominate", "invalid_photo");

  const { data, error } = await db().rpc("create_nominee", {
    p_device: device,
    p_categories: categories,
    p_person_name: personName,
    p_costume_name: costumeName,
    p_photo_path: photoPath,
  });
  if (error) return serverError("nominate", error);
  return data.status === "ok" ? json({ id: data.id }, 201) : reject("nominate", data.status);
}
