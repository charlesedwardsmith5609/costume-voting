import { readDevice } from "@/lib/server/device";
import { json, reject, serverError } from "@/lib/server/http";
import { db } from "@/lib/server/supabase";
import { INVALID, isUuid, parseCategories, readBody } from "@/lib/server/validate";

// POST { nomineeId, categories }. Adds an existing nominee to one or more categories, no new
// photo, in one atomic call; categories it already has are skipped.
// Owner: add_nominee_to_categories (nominee_categories, nominee_edits, rate_limits 'edit').
export async function POST(req: Request): Promise<Response> {
  const device = readDevice(req);
  if (!device) return reject("add-to-category", "invalid_device");
  const body = await readBody(req);
  if (!body || !isUuid(body.nomineeId)) return reject("add-to-category", "invalid_request");
  const categories = parseCategories(body.categories);
  if (categories === INVALID || categories.length === 0) return reject("add-to-category", "invalid_category");

  const { data, error } = await db().rpc("add_nominee_to_categories", {
    p_device: device,
    p_nominee: body.nomineeId,
    p_categories: categories,
  });
  if (error) return serverError("add-to-category", error);
  return data.status === "ok" ? json({ ok: true }) : reject("add-to-category", data.status);
}
