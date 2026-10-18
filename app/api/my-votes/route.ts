import { readDevice } from "@/lib/server/device";
import { json, reject, serverError } from "@/lib/server/http";
import { db } from "@/lib/server/supabase";

// This device's current pick per category: { votes: { [category]: nomineeId } }. Votes for
// hidden nominees are left out, so the guest sees no vote there and can vote again.
// Owner: votes. The only vote data a guest can get.
export async function GET(req: Request): Promise<Response> {
  const device = readDevice(req);
  if (!device) return reject("my-votes", "invalid_device");

  const client = db();
  const { data: votes, error } = await client.from("votes").select("category, nominee_id").eq("device_id", device);
  if (error) return serverError("my-votes", error);
  if (votes.length === 0) return json({ votes: {} });

  const ids = [...new Set(votes.map((v) => v.nominee_id as string))];
  const { data: visible, error: nErr } = await client.from("nominees").select("id").in("id", ids).eq("hidden", false);
  if (nErr) return serverError("my-votes", nErr);
  const visibleIds = new Set(visible.map((n) => n.id as string));

  const picks: Record<string, string> = {};
  for (const v of votes) if (visibleIds.has(v.nominee_id)) picks[v.category] = v.nominee_id;
  return json({ votes: picks });
}
