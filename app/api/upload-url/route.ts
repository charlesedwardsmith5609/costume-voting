import { readDevice } from "@/lib/server/device";
import { json, reject, serverError } from "@/lib/server/http";
import { BUCKET, db } from "@/lib/server/supabase";

// POST. Issues a signed upload URL for a guest/<uuid>.jpg path chosen by the database. The path
// carries no device ID; photo_uploads records which device it belongs to. The bucket enforces
// JPEG and 5 MB; create_nominee and edit_nominee accept the path once it is uploaded.
// Owner: issue_upload (rate_limits, photo_uploads, voting window), Storage.
export async function POST(req: Request): Promise<Response> {
  const device = readDevice(req);
  if (!device) return reject("upload-url", "invalid_device");

  const client = db();
  const { data: gate, error } = await client.rpc("issue_upload", { p_device: device });
  if (error) return serverError("upload-url", error);
  if (gate.status !== "ok") return reject("upload-url", gate.status);

  const path: string = gate.path;
  const { data, error: sErr } = await client.storage.from(BUCKET).createSignedUploadUrl(path);
  if (sErr) return serverError("upload-url", sErr);
  return json({ path, signedUrl: data.signedUrl, token: data.token });
}
