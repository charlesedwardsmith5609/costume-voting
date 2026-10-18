import { isCategory } from "@/lib/categories";
import { readDevice } from "@/lib/server/device";
import { json, reject, serverError } from "@/lib/server/http";
import { db } from "@/lib/server/supabase";
import { isUuid, readBody } from "@/lib/server/validate";

// POST { category, nomineeId }. Casts or changes this device's vote in the category.
// Owner: cast_vote (votes, rate_limits).
export async function POST(req: Request): Promise<Response> {
  const device = readDevice(req);
  if (!device) return reject("vote", "invalid_device");
  const body = await readBody(req);
  if (!body || !isUuid(body.nomineeId)) return reject("vote", "invalid_request");
  if (!isCategory(body.category)) return reject("vote", "invalid_category");

  const { data, error } = await db().rpc("cast_vote", {
    p_device: device,
    p_category: body.category,
    p_nominee: body.nomineeId,
  });
  if (error) return serverError("vote", error);
  return data === "ok" ? json({ ok: true }) : reject("vote", data);
}
