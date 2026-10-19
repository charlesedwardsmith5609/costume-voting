import { CATEGORIES, type CategorySlug } from "@/lib/categories";
import { requireAdmin } from "@/lib/server/admin";
import { json, serverError } from "@/lib/server/http";
import { db, photoUrl, thumbPath } from "@/lib/server/supabase";

const ORDER = CATEGORIES.map((c) => c.slug);

// GET. Every nominee, including hidden ones, newest first, for moderation. Owner: nominees.
export async function GET(req: Request): Promise<Response> {
  const denied = requireAdmin(req);
  if (denied) return denied;
  const client = db();
  const { data, error } = await client
    .from("nominees")
    .select("id, person_name, costume_name, photo_path, hidden, created_at, nominee_categories(category)")
    .order("created_at", { ascending: false })
    .order("id");
  if (error) return serverError("admin-nominees", error);
  return json({
    nominees: data.map((n) => ({
      id: n.id,
      personName: n.person_name,
      costumeName: n.costume_name,
      photoUrl: photoUrl(client, n.photo_path),
      thumbUrl: photoUrl(client, thumbPath(n.photo_path)),
      hidden: n.hidden,
      createdAt: n.created_at,
      categories: (n.nominee_categories as { category: CategorySlug }[])
        .map((c) => c.category)
        .sort((a, b) => ORDER.indexOf(a) - ORDER.indexOf(b)),
    })),
  });
}
