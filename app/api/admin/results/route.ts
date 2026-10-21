import { requireAdmin } from "@/lib/server/admin";
import { json, serverError } from "@/lib/server/http";
import { buildResults, loadResultData } from "@/lib/server/results";
import { db, photoUrl, thumbPath } from "@/lib/server/supabase";

// GET. Live results per category: non-hidden nominees ranked by votes (dense ranks), with photo
// and thumbnail URLs, total votes per category, and distinct voting devices overall. Hidden nominees and
// their votes are left out. Owner: votes, nominees, nominee_categories (read only).
export async function GET(req: Request): Promise<Response> {
  const denied = requireAdmin(req);
  if (denied) return denied;
  try {
    const client = db();
    const { nominees, votes } = await loadResultData(client);
    const results = buildResults(nominees, votes);
    return json({
      distinctDevices: results.distinctDevices,
      categories: results.categories.map((c) => ({
        category: c.category,
        label: c.label,
        totalVotes: c.totalVotes,
        nominees: c.nominees
          .filter((n) => !n.hidden)
          .map(({ photoPath, hidden: _hidden, ...n }) => ({
            ...n,
            photoUrl: photoUrl(client, photoPath),
            thumbUrl: photoUrl(client, thumbPath(photoPath)),
          })),
      })),
    });
  } catch (err) {
    return serverError("results", err);
  }
}
