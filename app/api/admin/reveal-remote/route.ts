import { requireAdmin } from "@/lib/server/admin";
import { json, reject, serverError } from "@/lib/server/http";
import { db } from "@/lib/server/supabase";
import { readBody } from "@/lib/server/validate";
import { isRevealCommand, TV_STALE_MS } from "@/lib/revealRemote";

// GET. The last command and its number, and the status the TV page last published
// (tvConnected is false when that is older than TV_STALE_MS or missing).
// Owner: reveal_remote (read only).
export async function GET(req: Request): Promise<Response> {
  const denied = requireAdmin(req);
  if (denied) return denied;
  const { data, error } = await db().from("reveal_remote").select("seq, command, state, state_at").eq("id", 1).single();
  if (error) return serverError("reveal-remote", error);
  const age = data.state_at ? Date.now() - new Date(data.state_at).getTime() : Infinity;
  return json({ seq: Number(data.seq), command: data.command, state: data.state, tvConnected: age < TV_STALE_MS });
}

// POST { command }. Sends one command to the TV page. Owner: send_reveal_command (reveal_remote).
export async function POST(req: Request): Promise<Response> {
  const denied = requireAdmin(req);
  if (denied) return denied;
  const body = await readBody(req);
  if (!isRevealCommand(body?.command)) return reject("reveal-remote", "invalid_request");
  const { data, error } = await db().rpc("send_reveal_command", { p_command: body.command });
  if (error) return serverError("reveal-remote", error);
  return data.status === "ok" ? json({ seq: Number(data.seq) }) : reject("reveal-remote", "invalid_request");
}
