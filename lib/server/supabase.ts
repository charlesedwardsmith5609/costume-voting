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
