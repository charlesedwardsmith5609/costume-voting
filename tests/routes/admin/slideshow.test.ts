import "../env";
import { beforeEach, describe, expect, it } from "vitest";
import { GET as photos } from "@/app/api/admin/photos/route";
import { POST as exclude } from "@/app/api/admin/slideshow-exclude/route";
import { admin, createNominee, newDevice, openVoting, resetDb, rpc, uploadPhoto } from "../../db/helpers";
import { call, get, post } from "../request";

beforeEach(async () => {
  await resetDb();
  await openVoting();
});

const list = async () => (await call(photos(get("/api/admin/photos", { admin: true })))).body.photos;
const setExcluded = (photoPath: unknown, excluded: unknown) =>
  call(exclude(post("/api/admin/slideshow-exclude", { admin: true, body: { photoPath, excluded } })));

describe("GET /api/admin/photos", () => {
  it("lists current, hidden, and unused photos with URLs", async () => {
    const al = await createNominee(newDevice(), "funniest", "Al");
    const hid = await createNominee(newDevice(), "funniest", "Hid");
    await admin.from("nominees").update({ hidden: true }).eq("id", hid);
    const unused = await uploadPhoto(newDevice());
    const hostUnused = await uploadPhoto("host");

    const all = await list();
    const bySource = (s: string) => all.filter((p: { source: string }) => p.source === s);
    expect(bySource("current").map((p: { label: string }) => p.label)).toEqual(["Al"]);
    expect(bySource("hidden").map((p: { label: string }) => p.label)).toEqual(["Hid"]);
    expect(bySource("unused").map((p: { path: string }) => p.path).sort()).toEqual([unused, hostUnused].sort());
    expect(all[0].photoUrl).toMatch(/\/storage\/v1\/object\/public\/nominee-photos\/.+\.jpg$/);
    expect(all[0].thumbUrl).toBe(all[0].photoUrl.replace(/\.jpg$/, ".thumb.jpg"));
    expect(al).toBeTruthy();
  });

  it("includes a photo that an edit replaced, labelled with its nominee", async () => {
    const device = newDevice();
    const id = await createNominee(device, "funniest", "Al");
    const next = await uploadPhoto("host");
    await rpc("admin_edit_nominee", { p_nominee: id, p_person_name: "Al", p_costume_name: null, p_photo_path: next, p_add_categories: [] });
    const all = await list();
    expect(all.filter((p: { source: string }) => p.source === "earlier")).toHaveLength(1);
    expect(all.filter((p: { source: string }) => p.source === "current")[0].path).toBe(next);
  });
});

describe("POST /api/admin/slideshow-exclude", () => {
  it("excludes and restores a photo, idempotently", async () => {
    await createNominee(newDevice(), "funniest", "Al");
    const path = (await list())[0].path;
    expect((await setExcluded(path, true)).status).toBe(200);
    expect((await setExcluded(path, true)).status).toBe(200);
    expect((await list())[0].excluded).toBe(true);
    expect((await setExcluded(path, false)).status).toBe(200);
    expect((await list())[0].excluded).toBe(false);
  });

  it("rejects a bad body", async () => {
    expect((await setExcluded(5, true)).status).toBe(400);
    expect((await setExcluded("guest/x.jpg", "yes")).status).toBe(400);
  });

  it("is cleared by reset", async () => {
    await setExcluded("guest/x.jpg", true);
    await resetDb();
    const { data } = await admin.from("slideshow_exclusions").select("photo_path");
    expect(data).toEqual([]);
  });
});
