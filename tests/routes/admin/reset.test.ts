import "../env";
import { beforeEach, describe, expect, it } from "vitest";
import { POST } from "@/app/api/admin/reset/route";
import { admin, countRows, createNominee, getNominee, getSettings, newDevice, openVoting, resetDb, rpc, uploadPhoto } from "../../db/helpers";
import { call, post } from "../request";

beforeEach(resetDb);

const reset = (confirm?: string) => call(POST(post("/api/admin/reset", { admin: true, body: { confirm } })));
const exists = async (path: string) => {
  const [dir, name] = path.split("/");
  const { data } = await admin.storage.from("nominee-photos").list(dir, { search: name });
  return (data ?? []).length === 1;
};

describe("POST /api/admin/reset", () => {
  it("requires the host to type RESET", async () => {
    await openVoting();
    await createNominee(newDevice(), "funniest", "Al");
    for (const confirm of [undefined, "reset", "RESET "]) {
      expect(await reset(confirm)).toMatchObject({ status: 400, body: { error: "confirm_required" } });
    }
    expect(await countRows("nominees")).toBe(1);
  });

  it("clears every table and the timer, and deletes current, replaced, and unused photos", async () => {
    await openVoting();
    const guest = newDevice();
    const n = await createNominee(guest, "funniest", "Al");
    const original = (await getNominee(n)).photo_path;
    const replacement = await uploadPhoto(guest);
    await rpc("edit_nominee", {
      p_device: guest,
      p_nominee: n,
      p_person_name: "Al",
      p_costume_name: null,
      p_photo_path: replacement,
      p_add_categories: [],
    });
    const unused = await uploadPhoto(newDevice());
    await rpc("cast_vote", { p_device: guest, p_category: "funniest", p_nominee: n });

    const { status, body } = await reset("RESET");
    expect(status).toBe(200);
    expect(body).toEqual({ ok: true, photosRemoved: 3, photosNotRemoved: 0 });
    for (const table of ["nominees", "nominee_categories", "votes", "nominee_edits", "photo_uploads", "rate_limits"]) {
      expect(await countRows(table), table).toBe(0);
    }
    expect(await getSettings()).toEqual({ voting_opens_at: null, voting_closes_at: null });
    for (const path of [original, replacement, unused]) expect(await exists(path), path).toBe(false);
  });
});
