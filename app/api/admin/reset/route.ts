import { requireAdmin } from "@/lib/server/admin";
import { json, reject, serverError } from "@/lib/server/http";
import { BUCKET, db, thumbPath } from "@/lib/server/supabase";
import { readBody } from "@/lib/server/validate";

// POST { confirm: "RESET" }. Clears all votes, nominees, edits, uploads, rate limits, and the
// timer in one transaction, then deletes the photos and their thumbnails from Storage. For testing before the party.
// Owner: reset_all (every table), Storage.
export async function POST(req: Request): Promise<Response> {
  const denied = requireAdmin(req);
  if (denied) return denied;
  const body = await readBody(req);
  if (body?.confirm !== "RESET") return reject("reset", "confirm_required");

  const client = db();
  const { data: paths, error } = await client.rpc("reset_all");
  if (error) return serverError("reset", error);

  // The database is already clear; a failed photo delete leaves an unused file, so report it
  // instead of failing the reset. Counts are photos; a missing thumbnail is not an error.
  let photosNotRemoved = 0;
  for (let i = 0; i < paths.length; i += 50) {
    const batch: string[] = paths.slice(i, i + 50);
    const { error: sErr } = await client.storage.from(BUCKET).remove(batch.flatMap((p) => [p, thumbPath(p)]));
    if (sErr) {
      console.error(`[reset] storage remove failed: ${sErr.message}`);
      photosNotRemoved += batch.length;
    }
  }
  return json({ ok: true, photosRemoved: paths.length - photosNotRemoved, photosNotRemoved });
}
