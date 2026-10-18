import { beforeEach, describe, expect, it } from "vitest";
import {
  anon,
  countRows,
  createNominee,
  FUNCTION_CALLS,
  getNominee,
  getSettings,
  newDevice,
  openVoting,
  resetDb,
  TABLES,
} from "./helpers";

// The browser only ever has the anon (publishable) key. It must not be able to call any
// function or touch any table; every call below must fail and leave the database unchanged.

// PostgREST answers 42501 (permission denied) for a revoked function or table. PGRST202 means
// the function is not visible to this role at all, which is also a rejection.
const REJECTED = ["42501", "PGRST202"];

const uuid = () => newDevice();

beforeEach(resetDb);

describe("anon key", () => {
  it.each(FUNCTION_CALLS)("cannot execute %s", async (fn, args) => {
    const { data, error } = await anon.rpc(fn, args);
    expect(data).toBeNull();
    expect(error, `${fn} should be rejected`).not.toBeNull();
    expect(REJECTED).toContain(error!.code);
  });

  it("cannot change state through functions", async () => {
    await openVoting(30);
    const before = await getSettings();
    const n = await createNominee(newDevice(), "funniest", "Alex");

    await anon.rpc("set_timer", { p_action: "end" });
    await anon.rpc("reset_all");
    await anon.rpc("cast_vote", { p_device: uuid(), p_category: "funniest", p_nominee: n });
    await anon.rpc("edit_nominee", {
      p_device: uuid(),
      p_nominee: n,
      p_person_name: "Hacked",
      p_costume_name: null,
      p_photo_path: null,
      p_add_categories: ["most_unique"],
    });

    expect(await getSettings()).toEqual(before);
    expect(await countRows("nominees")).toBe(1);
    expect(await countRows("votes")).toBe(0);
    expect(await countRows("nominee_edits")).toBe(0);
    expect((await getNominee(n)).person_name).toBe("Alex");
  });

  // A 42501 here also proves the publishable key itself is accepted: an invalid key is
  // rejected by the API gateway before Postgres sees the request.
  it.each(TABLES)("cannot read table %s", async (table) => {
    const { data, error } = await anon.from(table).select("*");
    expect(data).toBeNull();
    expect(error?.code).toBe("42501");
  });

  it("cannot write tables", async () => {
    const { error } = await anon
      .from("nominees")
      .insert({ person_name: "x", photo_path: "x.jpg", created_by_device: uuid() });
    expect(error).not.toBeNull();
  });

  it("cannot upload to or list the photo bucket", async () => {
    const up = await anon.storage
      .from("nominee-photos")
      .upload(`${uuid()}/${uuid()}.jpg`, new Uint8Array([0xff, 0xd8]), { contentType: "image/jpeg" });
    expect(up.error).not.toBeNull();

    await openVoting();
    await createNominee(newDevice(), "funniest", "Alex");
    const list = await anon.storage.from("nominee-photos").list();
    expect(list.data ?? []).toEqual([]);
  });
});
