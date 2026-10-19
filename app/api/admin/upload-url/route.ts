import { randomUUID } from "node:crypto";
import { requireAdmin } from "@/lib/server/admin";
import { json, serverError } from "@/lib/server/http";
import { BUCKET, db } from "@/lib/server/supabase";

// POST. Signed upload URL for host/<uuid>.jpg, for host photo replacements. No voting window
// or rate limit. admin_edit_nominee accepts the path once uploaded. Owner: Storage.
export async function POST(req: Request): Promise<Response> {
  const denied = requireAdmin(req);
  if (denied) return denied;
  const path = `host/${randomUUID()}.jpg`;
  const { data, error } = await db().storage.from(BUCKET).createSignedUploadUrl(path);
  if (error) return serverError("admin-upload-url", error);
  return json({ path, signedUrl: data.signedUrl, token: data.token });
}
