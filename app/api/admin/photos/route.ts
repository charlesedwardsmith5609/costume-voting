import { requireAdmin } from "@/lib/server/admin";
import { json, serverError } from "@/lib/server/http";
import { buildSlideshowPhotos } from "@/lib/server/slideshow";
import { BUCKET, db, photoUrl, thumbPath } from "@/lib/server/supabase";

const HOST_PHOTO = /^[0-9a-f-]{36}\.jpg$/;

// GET. Every photo for the final slideshow: nominees' current photos (hidden ones too), photos an
// edit replaced, and uploads nothing uses (recorded guest uploads and files in host/), each with
// its source and whether the host removed it from the slideshow.
// Owner: nominees, nominee_edits, photo_uploads, slideshow_exclusions, Storage (read only).
export async function GET(req: Request): Promise<Response> {
  const denied = requireAdmin(req);
  if (denied) return denied;
  try {
    const client = db();
    const [nominees, edits, uploads, excluded, hostFiles] = await Promise.all([
      client.from("nominees").select("id, person_name, costume_name, photo_path, hidden"),
      client.from("nominee_edits").select("nominee_id, old_photo_path, new_photo_path"),
      client.from("photo_uploads").select("path"),
      client.from("slideshow_exclusions").select("photo_path"),
      client.storage.from(BUCKET).list("host", { limit: 1000 }),
    ]);
    for (const r of [nominees, edits, uploads, excluded, hostFiles]) if (r.error) return serverError("photos", r.error);

    const uploadPaths = [
      ...(uploads.data ?? []).map((u) => u.path as string),
      ...(hostFiles.data ?? []).filter((f) => HOST_PHOTO.test(f.name)).map((f) => `host/${f.name}`),
    ];
    const photos = buildSlideshowPhotos({
      nominees: nominees.data ?? [],
      edits: edits.data ?? [],
      uploadPaths,
      excluded: new Set((excluded.data ?? []).map((e) => e.photo_path as string)),
    });
    return json({
      photos: photos.map((p) => ({ ...p, photoUrl: photoUrl(client, p.path), thumbUrl: photoUrl(client, thumbPath(p.path)) })),
    });
  } catch (err) {
    return serverError("photos", err);
  }
}
