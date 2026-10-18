import { isCategory } from "@/lib/categories";
import { readDevice } from "@/lib/server/device";
import { json, reject, serverError } from "@/lib/server/http";
import { db } from "@/lib/server/supabase";
import { isUuid, readBody } from "@/lib/server/validate";

// POST { nomineeId, category }. Adds an existing nominee to one more category, no new photo.
// Owner: add_nominee_to_category (nominee_categories, nominee_edits, rate_limits 'edit').
export async function POST(req: Request): Promise<Response> {
  const device = readDevice(req);
  if (!device) return reject("add-to-category", "invalid_device");
  const body = await readBody(req);
  if (!body || !isUuid(body.nomineeId)) return reject("add-to-category", "invalid_request");
  if (!isCategory(body.category)) return reject("add-to-category", "invalid_category");

  const { data, error } = await db().rpc("add_nominee_to_category", {
    p_device: device,
    p_nominee: body.nomineeId,
    p_category: body.category,
  });
  if (error) return serverError("add-to-category", error);
  return data.status === "ok" ? json({ ok: true }) : reject("add-to-category", data.status);
}
