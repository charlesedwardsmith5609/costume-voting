import { requireAdmin } from "@/lib/server/admin";
import { serverError } from "@/lib/server/http";
import { buildResults, loadResultData, toCsv } from "@/lib/server/results";
import { db, photoUrl } from "@/lib/server/supabase";

// GET. CSV download: one row per nominee per category, dense ranks, hidden nominees last with an
// empty rank and their stored votes. Owner: votes, nominees, nominee_categories (read only).
export async function GET(req: Request): Promise<Response> {
  const denied = requireAdmin(req);
  if (denied) return denied;
  try {
    const client = db();
    const { nominees, votes } = await loadResultData(client);
    const csv = toCsv(buildResults(nominees, votes), (path) => photoUrl(client, path));
    return new Response(csv, {
      headers: {
        "content-type": "text/csv; charset=utf-8",
        "content-disposition": 'attachment; filename="costume-results.csv"',
        "cache-control": "no-store",
      },
    });
  } catch (err) {
    return serverError("export", err);
  }
}
