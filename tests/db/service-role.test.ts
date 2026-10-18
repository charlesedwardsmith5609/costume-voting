import { randomUUID } from "node:crypto";
import { beforeEach, describe, expect, it } from "vitest";
import { admin, FUNCTION_CALLS, resetDb } from "./helpers";

// "Automatically expose new tables" is off, so the service role (secret key) only has what the
// migration grants. Every table must accept select/insert/update/delete and every function must
// be callable; a missing grant shows up as 42501.

beforeEach(resetDb);

async function ok<T>(label: string, p: PromiseLike<{ data: T; error: { code: string; message: string } | null }>) {
  const { data, error } = await p;
  expect(error, `${label}: ${error?.code} ${error?.message}`).toBeNull();
  return data;
}

describe("service role", () => {
  it.each(FUNCTION_CALLS)("can execute %s", async (fn, args) => {
    await ok(fn, admin.rpc(fn, args));
  });

  it("can read and write settings", async () => {
    await ok("select", admin.from("settings").select("*"));
    // The single settings row already exists; ignoreDuplicates still needs INSERT privilege.
    await ok("insert", admin.from("settings").upsert({ id: 1 }, { ignoreDuplicates: true }));
    await ok("update", admin.from("settings").update({ voting_opens_at: null }).eq("id", 1));
    // Matches no row, but still needs DELETE privilege.
    await ok("delete", admin.from("settings").delete().eq("id", 2));
  });

  it("can read and write nominees, nominee_categories, votes, and nominee_edits", async () => {
    const device = randomUUID();
    const nominee = await ok(
      "insert nominees",
      admin
        .from("nominees")
        .insert({ person_name: "Sam", photo_path: `seed/${randomUUID()}.jpg`, created_by_device: device })
        .select("id")
        .single(),
    );
    const id = (nominee as { id: string }).id;
    await ok("insert nominee_categories", admin.from("nominee_categories").insert({ nominee_id: id, category: "funniest" }));
    await ok("insert votes", admin.from("votes").insert({ device_id: device, category: "funniest", nominee_id: id }));
    // Identity column: also exercises the nominee_edits sequence grant.
    await ok(
      "insert nominee_edits",
      admin.from("nominee_edits").insert({ nominee_id: id, old_photo_path: "a.jpg", new_photo_path: "b.jpg" }),
    );

    for (const table of ["nominees", "nominee_categories", "votes", "nominee_edits"]) {
      await ok(`select ${table}`, admin.from(table).select("*"));
    }
    await ok("update nominees", admin.from("nominees").update({ hidden: true }).eq("id", id));
    await ok("update nominee_categories", admin.from("nominee_categories").update({ added_at: new Date().toISOString() }).eq("nominee_id", id));
    await ok("update votes", admin.from("votes").update({ updated_at: new Date().toISOString() }).eq("nominee_id", id));
    await ok("update nominee_edits", admin.from("nominee_edits").update({ device_id: device }).eq("nominee_id", id));

    await ok("delete votes", admin.from("votes").delete().eq("nominee_id", id));
    await ok("delete nominee_edits", admin.from("nominee_edits").delete().eq("nominee_id", id));
    await ok("delete nominee_categories", admin.from("nominee_categories").delete().eq("nominee_id", id));
    await ok("delete nominees", admin.from("nominees").delete().eq("id", id));
  });

  it("can read and write photo_uploads", async () => {
    const path = `guest/${randomUUID()}.jpg`;
    await ok("insert", admin.from("photo_uploads").insert({ path, device_id: randomUUID() }));
    await ok("select", admin.from("photo_uploads").select("*"));
    await ok("update", admin.from("photo_uploads").update({ created_at: new Date().toISOString() }).eq("path", path));
    await ok("delete", admin.from("photo_uploads").delete().eq("path", path));
  });

  it("can read and write rate_limits", async () => {
    const device = randomUUID();
    const row = { device_id: device, action: "vote", window_start: new Date().toISOString(), count: 1 };
    await ok("insert", admin.from("rate_limits").insert(row));
    await ok("select", admin.from("rate_limits").select("*"));
    await ok("update", admin.from("rate_limits").update({ count: 2 }).eq("device_id", device));
    await ok("delete", admin.from("rate_limits").delete().eq("device_id", device));
  });
});
