import { requireAdmin } from "@/lib/server/admin";
import { json, reject, serverError } from "@/lib/server/http";
import { db } from "@/lib/server/supabase";
import { readBody } from "@/lib/server/validate";

// POST { published }. Publishes results to guests (only after voting has closed) or unpublishes
// them. Reopening voting unpublishes too. Owner: set_results_published (settings).
export async function POST(req: Request): Promise<Response> {
  const denied = requireAdmin(req);
  if (denied) return denied;
  const body = await readBody(req);
  if (!body || typeof body.published !== "boolean") return reject("publish", "invalid_request");

  const { data, error } = await db().rpc("set_results_published", { p_published: body.published });
  if (error) return serverError("publish", error);
  return data.status === "ok" ? json({ resultsPublished: data.results_published }) : reject("publish", data.status);
}
