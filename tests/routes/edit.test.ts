import "./env";
import { beforeEach, describe, expect, it } from "vitest";
import { POST } from "@/app/api/edit/route";
import {
  admin,
  categoriesOf,
  closeVoting,
  createNominee,
  fillRateLimit,
  getNominee,
  newDevice,
  openVoting,
  resetDb,
  uploadPhoto,
} from "../db/helpers";
import { call, post } from "./request";

beforeEach(resetDb);

const edit = (device: string | null, body: Record<string, unknown>) => call(POST(post("/api/edit", { device, body })));

describe("POST /api/edit", () => {
  it("changes names and photo and adds categories, logging old and new values", async () => {
    await openVoting();
    const n = await createNominee(newDevice(), "funniest", null, null);
    const before = await getNominee(n);
    const me = newDevice();
    const photoPath = await uploadPhoto(me);
    const res = await edit(me, {
      nomineeId: n,
      personName: " Sam ",
      costumeName: "The Mad Hatter",
      photoPath,
      addCategories: ["most_elaborate"],
    });
    expect(res).toEqual({ status: 200, body: { ok: true } });
    expect(await getNominee(n)).toMatchObject({ person_name: "Sam", costume_name: "The Mad Hatter", photo_path: photoPath });
    expect(await categoriesOf(n)).toEqual(["funniest", "most_elaborate"]);
    const { data } = await admin.from("nominee_edits").select("*").eq("nominee_id", n);
    expect(data).toHaveLength(1);
    expect(data![0]).toMatchObject({
      device_id: me,
      old_person_name: null,
      new_person_name: "Sam",
      old_photo_path: before.photo_path,
      new_photo_path: photoPath,
      added_categories: ["most_elaborate"],
    });
  });

  it("requires both name keys so a missing field never clears a name", async () => {
    await openVoting();
    const n = await createNominee(newDevice(), "funniest", "Sam", "The Mad Hatter");
    expect((await edit(newDevice(), { nomineeId: n, personName: "Pat" })).body.error).toBe("invalid_request");
    expect(await getNominee(n)).toMatchObject({ person_name: "Sam", costume_name: "The Mad Hatter" });
    expect((await edit(newDevice(), { nomineeId: n, personName: "Pat", costumeName: null })).status).toBe(200);
    expect(await getNominee(n)).toMatchObject({ person_name: "Pat", costume_name: null });
  });

  it("reports no_change (409), and hidden or unknown nominees (404)", async () => {
    await openVoting();
    const n = await createNominee(newDevice(), "funniest", "Sam");
    const same = { nomineeId: n, personName: "Sam", costumeName: null };
    expect(await edit(newDevice(), same)).toMatchObject({ status: 409, body: { error: "no_change" } });
    expect((await edit(newDevice(), { ...same, nomineeId: newDevice() })).status).toBe(404);
    await admin.from("nominees").update({ hidden: true }).eq("id", n);
    expect((await edit(newDevice(), { ...same, personName: "Pat" })).status).toBe(404);
  });

  it("validates names, categories, photo, and device", async () => {
    await openVoting();
    const n = await createNominee(newDevice(), "funniest", "Sam");
    const base = { nomineeId: n, personName: "Sam", costumeName: null };
    expect((await edit(newDevice(), { ...base, costumeName: "bad\u0007" })).body.error).toBe("invalid_name");
    expect((await edit(newDevice(), { ...base, addCategories: ["scariest"] })).body.error).toBe("invalid_category");
    expect((await edit(newDevice(), { ...base, photoPath: await uploadPhoto(newDevice()) })).body.error).toBe(
      "invalid_photo",
    );
    expect((await edit(null, { ...base, personName: "Pat" })).body.error).toBe("invalid_device");
  });

  it("is rejected after voting closes", async () => {
    await openVoting();
    const n = await createNominee(newDevice(), "funniest", "Sam");
    await closeVoting();
    const res = await edit(newDevice(), { nomineeId: n, personName: "Pat", costumeName: null });
    expect(res).toMatchObject({ status: 403, body: { error: "closed" } });
    expect((await getNominee(n)).person_name).toBe("Sam");
  });

  it("rate limits a device to 10 edits per window", async () => {
    await openVoting();
    const n = await createNominee(newDevice(), "funniest", "Sam");
    const me = newDevice();
    await fillRateLimit(me, "edit", 9);
    expect((await edit(me, { nomineeId: n, personName: "Pat", costumeName: null })).status).toBe(200);
    expect((await edit(me, { nomineeId: n, personName: "Jo", costumeName: null })).status).toBe(429);
  });
});
