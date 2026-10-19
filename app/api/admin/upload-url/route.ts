import { randomUUID } from "node:crypto";
import { requireAdmin } from "@/lib/server/admin";
import { json, serverError } from "@/lib/server/http";
import { db, signedUploads } from "@/lib/server/supabase";

// POST. Signed upload URLs for host/<uuid>.jpg and its thumbnail, for host photo replacements. No voting window
// or rate limit. admin_edit_nominee accepts the path once uploaded. Owner: Storage.
export async function POST(req: Request): Promise<Response> {
  const denied = requireAdmin(req);
  if (denied) return denied;
  try {
    return json(await signedUploads(db(), `host/${randomUUID()}.jpg`));
  } catch (err) {
    return serverError("admin-upload-url", err);
  }
}
