import { json, reject, serverError } from "@/lib/server/http";
import { buildGuestResults, buildResults, loadResultData } from "@/lib/server/results";
import { db, photoUrl } from "@/lib/server/supabase";

export const dynamic = "force-dynamic";

// GET. Published results for guests: rank order per category and "also nominated", never vote
// counts. 403 not_published until the host publishes (and while voting is open).
// Owner: settings (via guest_state), votes, nominees, nominee_categories (read only).
export async function GET(): Promise<Response> {
  try {
    const client = db();
    const { data: state, error } = await client.rpc("guest_state");
    if (error) throw error;
    if (!state.results_published) return reject("results", "not_published");
    const { nominees, votes } = await loadResultData(client);
    return json(buildGuestResults(buildResults(nominees, votes), (path) => photoUrl(client, path)));
  } catch (err) {
    return serverError("results", err);
  }
}
