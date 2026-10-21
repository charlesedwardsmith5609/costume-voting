// Server-only: holds the service role key. Never import from a client component.
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

export const BUCKET = "nominee-photos";

// A fresh client per request; route handlers keep no state between requests.
export function db(): SupabaseClient {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set");
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}

export function photoUrl(client: SupabaseClient, path: string): string {
  return client.storage.from(BUCKET).getPublicUrl(path).data.publicUrl;
}

// Each photo's small copy for grids and strips sits next to it: x/<uuid>.jpg -> x/<uuid>.thumb.jpg.
// photo_is_fresh only accepts paths ending in <uuid>.jpg, so a thumbnail can never be a photo.
export function thumbPath(path: string): string {
  return path.replace(/\.jpg$/, ".thumb.jpg");
}

// Signed upload URLs for a photo and its thumbnail. Uploading twice to one URL fails, so the
// browser uploads each once and retries only the one that failed.
export async function signedUploads(client: SupabaseClient, path: string) {
  const bucket = client.storage.from(BUCKET);
  const [photo, thumb] = await Promise.all([
    bucket.createSignedUploadUrl(path),
    bucket.createSignedUploadUrl(thumbPath(path)),
  ]);
  if (photo.error) throw photo.error;
  if (thumb.error) throw thumb.error;
  return { path, signedUrl: photo.data.signedUrl, token: photo.data.token, thumbSignedUrl: thumb.data.signedUrl };
}
