import { clearedSessionCookie, requireAdmin } from "@/lib/server/admin";
import { json } from "@/lib/server/http";

// POST. Clears the admin session cookie.
export async function POST(req: Request): Promise<Response> {
  const denied = requireAdmin(req);
  if (denied) return denied;
  return json({ ok: true }, 200, { "set-cookie": clearedSessionCookie(req) });
}
