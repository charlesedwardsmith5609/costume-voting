import { requireAdmin } from "@/lib/server/admin";
import { json, reject, serverError } from "@/lib/server/http";
import { db, photoUrl } from "@/lib/server/supabase";
import { isUuid } from "@/lib/server/validate";

type EditRow = {
  id: number;
  device_id: string | null;
  old_person_name: string | null;
  new_person_name: string | null;
  old_costume_name: string | null;
  new_costume_name: string | null;
  old_photo_path: string;
  new_photo_path: string;
  added_categories: string[];
  removed_categories: string[];
  undoes_edit_id: number | null;
  created_at: string;
};

// GET ?nomineeId=. Edit history, newest first. deviceId is null for host edits.
// Owner: nominee_edits (read only).
export async function GET(req: Request): Promise<Response> {
  const denied = requireAdmin(req);
  if (denied) return denied;
  const nomineeId = new URL(req.url).searchParams.get("nomineeId");
  if (!isUuid(nomineeId)) return reject("edits", "invalid_request");

  const client = db();
  const { data, error } = await client
    .from("nominee_edits")
    .select(
      "id, device_id, old_person_name, new_person_name, old_costume_name, new_costume_name, " +
        "old_photo_path, new_photo_path, added_categories, removed_categories, undoes_edit_id, created_at",
    )
    .eq("nominee_id", nomineeId)
    .order("id", { ascending: false });
  if (error) return serverError("edits", error);
  return json({
    edits: (data as unknown as EditRow[]).map((e) => ({
      id: e.id,
      deviceId: e.device_id,
      oldPersonName: e.old_person_name,
      newPersonName: e.new_person_name,
      oldCostumeName: e.old_costume_name,
      newCostumeName: e.new_costume_name,
      oldPhotoUrl: photoUrl(client, e.old_photo_path),
      newPhotoUrl: photoUrl(client, e.new_photo_path),
      addedCategories: e.added_categories,
      removedCategories: e.removed_categories,
      undoesEditId: e.undoes_edit_id,
      createdAt: e.created_at,
    })),
  });
}
