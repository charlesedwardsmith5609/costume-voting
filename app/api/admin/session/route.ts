import { requireAdmin } from "@/lib/server/admin";
import { json } from "@/lib/server/http";

// GET. 200 while the admin session cookie is valid, 401 otherwise.
export async function GET(req: Request): Promise<Response> {
  const denied = requireAdmin(req);
  if (denied) return denied;
  return json({ ok: true });
}
