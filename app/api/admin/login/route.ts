import { allowLoginAttempt, passwordMatches, sessionCookie } from "@/lib/server/admin";
import { json, reject, serverError } from "@/lib/server/http";
import { db } from "@/lib/server/supabase";
import { readBody } from "@/lib/server/validate";

// POST { password }. Sets the admin session cookie. The only admin route without requireAdmin.
// Limited to 10 attempts per IP per 10 minutes. Owner: check_rate_limit (rate_limits 'login').
export async function POST(req: Request): Promise<Response> {
  try {
    if (!(await allowLoginAttempt(db(), req))) return reject("login", "rate_limited");
    const body = await readBody(req);
    if (!body || !passwordMatches(body.password)) return reject("login", "wrong_password");
    return json({ ok: true }, 200, { "set-cookie": sessionCookie(req) });
  } catch (err) {
    return serverError("login", err);
  }
}
