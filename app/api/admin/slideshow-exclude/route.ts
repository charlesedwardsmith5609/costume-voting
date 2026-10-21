import { requireAdmin } from "@/lib/server/admin";
import { json, reject, serverError } from "@/lib/server/http";
import { db } from "@/lib/server/supabase";
import { parsePhotoPath, readBody, INVALID } from "@/lib/server/validate";

// POST { photoPath, excluded }. Removes a photo from the final slideshow, or puts it back.
// One statement, so no function. Owner: slideshow_exclusions.
export async function POST(req: Request): Promise<Response> {
  const denied = requireAdmin(req);
  if (denied) return denied;
  const body = await readBody(req);
  const path = parsePhotoPath(body?.photoPath);
  if (path === INVALID || typeof body?.excluded !== "boolean") return reject("slideshow-exclude", "invalid_request");

  const table = db().from("slideshow_exclusions");
  const { error } = body.excluded
    ? await table.upsert({ photo_path: path }, { onConflict: "photo_path", ignoreDuplicates: true })
    : await table.delete().eq("photo_path", path);
  if (error) return serverError("slideshow-exclude", error);
  return json({ ok: true });
}
