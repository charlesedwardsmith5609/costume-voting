import { isCategory } from "@/lib/categories";
import { json, reject, serverError } from "@/lib/server/http";
import { loadNominees, nomineeLists } from "@/lib/server/nominees";
import { db } from "@/lib/server/supabase";

// GET /api/nominees?category=<slug>[&q=<name>&q=<name>]
// Non-hidden nominees in the category, newest first, plus the "Already nominated?" strips and
// name matches. Owner: nominees, nominee_categories. Never reads votes.
export async function GET(req: Request): Promise<Response> {
  const params = new URL(req.url).searchParams;
  const category = params.get("category");
  if (!isCategory(category)) return reject("nominees", "invalid_category");
  const queries = params.getAll("q").slice(0, 2).map((q) => q.slice(0, 60));

  try {
    const client = db();
    return json(nomineeLists(client, await loadNominees(client), category, queries));
  } catch (err) {
    return serverError("nominees", err);
  }
}
