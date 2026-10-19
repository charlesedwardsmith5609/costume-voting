import "../env";
import { beforeEach, describe, expect, it } from "vitest";
import { POST as del } from "@/app/api/admin/delete/route";
import { POST as edit } from "@/app/api/admin/edit/route";
import { GET as edits } from "@/app/api/admin/edits/route";
import { POST as hide } from "@/app/api/admin/hide/route";
import { POST as merge } from "@/app/api/admin/merge/route";
import { GET as adminNominees } from "@/app/api/admin/nominees/route";
import { POST as setCategory } from "@/app/api/admin/set-category/route";
import { POST as undo } from "@/app/api/admin/undo/route";
import { POST as uploadUrl } from "@/app/api/admin/upload-url/route";
import { GET as guestNominees } from "@/app/api/nominees/route";
import { POST as guestEdit } from "@/app/api/edit/route";
import { POST as guestVote } from "@/app/api/vote/route";
import {
  admin,
  categoriesOf,
  closeVoting,
  countRows,
  createNominee,
  getNominee,
  newDevice,
  openVoting,
  resetDb,
  rpc,
  uploadPhoto,
  votesFor,
} from "../../db/helpers";
import { call, get, post, putSigned } from "../request";

beforeEach(async () => {
  await resetDb();
  await openVoting();
});

const as = <T extends Record<string, unknown>>(handler: (r: Request) => Promise<Response>, path: string, body: T) =>
  call(handler(post(path, { admin: true, body })));
const vote = (device: string, category: string, nominee: string) =>
  rpc<string>("cast_vote", { p_device: device, p_category: category, p_nominee: nominee });
const guestIds = async (category: string) =>
  (await call(guestNominees(get(`/api/nominees?category=${category}`)))).body.nominees.map((n: { id: string }) => n.id);

describe("hide and delete", () => {
  it("hiding removes the nominee from guest views in every category and from new votes", async () => {
    const n = await createNominee(newDevice(), ["funniest", "most_unique"], "Al");
    expect(await as(hide, "/api/admin/hide", { nomineeId: n, hidden: true })).toEqual({ status: 200, body: { ok: true } });
    expect(await guestIds("funniest")).toEqual([]);
    expect(await guestIds("most_unique")).toEqual([]);
    const res = await call(guestVote(post("/api/vote", { device: newDevice(), body: { category: "funniest", nomineeId: n } })));
    expect(res.status).toBe(404);

    expect((await as(hide, "/api/admin/hide", { nomineeId: n, hidden: false })).status).toBe(200);
    expect(await guestIds("funniest")).toEqual([n]);
  });

  it("the moderation list includes hidden nominees", async () => {
    const n = await createNominee(newDevice(), "funniest", "Al");
    await as(hide, "/api/admin/hide", { nomineeId: n, hidden: true });
    const { body } = await call(adminNominees(get("/api/admin/nominees", { admin: true })));
    expect(body.nominees).toMatchObject([{ id: n, hidden: true, categories: ["funniest"], personName: "Al" }]);
  });

  it("delete removes the nominee and its votes but keeps its photo in Storage", async () => {
    const n = await createNominee(newDevice(), "funniest", "Al");
    const { photo_path } = await getNominee(n);
    await vote(newDevice(), "funniest", n);
    expect((await as(del, "/api/admin/delete", { nomineeId: n })).status).toBe(200);
    expect(await countRows("nominees")).toBe(0);
    expect(await countRows("votes")).toBe(0);
    const { data } = await admin.storage.from("nominee-photos").list("guest", { search: photo_path.split("/")[1] });
    expect(data).toHaveLength(1);
  });

  it("reports unknown nominees (404) and bad input (400)", async () => {
    expect((await as(hide, "/api/admin/hide", { nomineeId: newDevice(), hidden: true })).status).toBe(404);
    expect((await as(hide, "/api/admin/hide", { nomineeId: newDevice(), hidden: "yes" })).status).toBe(400);
    expect((await as(del, "/api/admin/delete", { nomineeId: newDevice() })).status).toBe(404);
    expect((await as(del, "/api/admin/delete", { nomineeId: "x" })).status).toBe(400);
  });
});

describe("categories", () => {
  it("removing a category deletes only that category's votes; the last one cannot be removed", async () => {
    const n = await createNominee(newDevice(), ["funniest", "most_unique"], "Al");
    await vote(newDevice(), "funniest", n);
    await vote(newDevice(), "most_unique", n);
    const set = (category: string, present: boolean) =>
      as(setCategory, "/api/admin/set-category", { nomineeId: n, category, present });

    expect((await set("funniest", false)).status).toBe(200);
    expect(await votesFor(n, "funniest")).toBe(0);
    expect(await votesFor(n, "most_unique")).toBe(1);
    expect(await set("most_unique", false)).toMatchObject({ status: 409, body: { error: "last_category" } });
    expect(await categoriesOf(n)).toEqual(["most_unique"]);
    expect((await set("best_couples", true)).status).toBe(200);
    expect(await set("best_couples", true)).toMatchObject({ status: 409, body: { error: "no_change" } });
    expect((await set("scariest", true)).status).toBe(400);
  });
});

describe("host edits, upload URL, history, and undo", () => {
  it("the host edits names and photo after voting closes, when a guest cannot", async () => {
    const n = await createNominee(newDevice(), "funniest", "Al");
    await closeVoting();
    const g = await call(guestEdit(post("/api/edit", { device: newDevice(), body: { nomineeId: n, personName: "X", costumeName: null } })));
    expect(g.status).toBe(403);

    const up = await call(uploadUrl(post("/api/admin/upload-url", { admin: true })));
    expect(up.status).toBe(200);
    expect(up.body.path).toMatch(/^host\/[0-9a-f-]{36}\.jpg$/);
    await putSigned(up.body.signedUrl);
    const res = await as(edit, "/api/admin/edit", {
      nomineeId: n,
      personName: "Sam",
      costumeName: "The Mad Hatter",
      photoPath: up.body.path,
      addCategories: ["most_unique"],
    });
    expect(res).toEqual({ status: 200, body: { ok: true } });
    expect(await getNominee(n)).toMatchObject({ person_name: "Sam", costume_name: "The Mad Hatter", photo_path: up.body.path });
    expect(await categoriesOf(n)).toEqual(["funniest", "most_unique"]);
  });

  it("host photos must come from the host upload URL", async () => {
    const n = await createNominee(newDevice(), "funniest", "Al");
    const guestPhoto = await uploadPhoto(newDevice());
    const res = await as(edit, "/api/admin/edit", { nomineeId: n, personName: "Al", costumeName: null, photoPath: guestPhoto });
    expect(res).toMatchObject({ status: 400, body: { error: "invalid_photo" } });
    expect((await as(edit, "/api/admin/edit", { nomineeId: n, personName: "Al" })).status).toBe(400);
  });

  it("history shows who changed what, and undo (and undo of the undo) restores it", async () => {
    const guest = newDevice();
    const n = await createNominee(newDevice(), "funniest", "Al");
    const original = (await getNominee(n)).photo_path;
    const photoPath = await uploadPhoto(guest);
    await call(guestEdit(post("/api/edit", { device: guest, body: { nomineeId: n, personName: "Pat", costumeName: null, photoPath } })));

    const history = async () => (await call(edits(get(`/api/admin/edits?nomineeId=${n}`, { admin: true })))).body.edits;
    const [first] = await history();
    expect(first).toMatchObject({ deviceId: guest, oldPersonName: "Al", newPersonName: "Pat", undoesEditId: null });
    expect(first.oldPhotoUrl).toContain(original);
    expect(first.newPhotoUrl).toContain(photoPath);

    expect((await as(undo, "/api/admin/undo", { editId: first.id })).status).toBe(200);
    expect(await getNominee(n)).toMatchObject({ person_name: "Al", photo_path: original });
    const [undoEdit] = await history();
    expect(undoEdit).toMatchObject({ deviceId: null, undoesEditId: first.id });

    expect((await as(undo, "/api/admin/undo", { editId: undoEdit.id })).status).toBe(200);
    expect(await getNominee(n)).toMatchObject({ person_name: "Pat", photo_path: photoPath });
    expect(await history()).toHaveLength(3);

    expect((await as(undo, "/api/admin/undo", { editId: 999999999 })).status).toBe(404);
    expect((await as(undo, "/api/admin/undo", { editId: "1" })).status).toBe(400);
    expect((await call(edits(get("/api/admin/edits?nomineeId=x", { admin: true })))).status).toBe(400);
  });
});

describe("POST /api/admin/merge", () => {
  it("unions categories, moves votes, and never leaves a device two votes in a category", async () => {
    const keep = await createNominee(newDevice(), "funniest", "Sam", "Mad Hatter");
    const drop = await createNominee(newDevice(), ["funniest", "most_elaborate"], "sam", "mad hatter");
    const [both, onlyDrop] = [newDevice(), newDevice()];
    await vote(both, "funniest", keep);
    await vote(onlyDrop, "funniest", drop);
    await vote(both, "most_elaborate", drop);

    expect(await as(merge, "/api/admin/merge", { keepId: keep, dropId: drop })).toEqual({ status: 200, body: { ok: true } });
    expect(await categoriesOf(keep)).toEqual(["funniest", "most_elaborate"]);
    expect(await votesFor(keep, "funniest")).toBe(2);
    expect(await votesFor(keep, "most_elaborate")).toBe(1);
    expect(await getNominee(keep)).toMatchObject({ person_name: "Sam", costume_name: "Mad Hatter" });
    expect(await countRows("nominees")).toBe(1);
    const { data } = await admin.from("votes").select("device_id, category");
    const keys = data!.map((r) => `${r.device_id}:${r.category}`);
    expect(new Set(keys).size).toBe(keys.length);
  });

  it("rejects merging a nominee with itself, unknown nominees, and bad input", async () => {
    const n = await createNominee(newDevice(), "funniest", "Al");
    expect(await as(merge, "/api/admin/merge", { keepId: n, dropId: n })).toMatchObject({ status: 400, body: { error: "same_nominee" } });
    expect((await as(merge, "/api/admin/merge", { keepId: n, dropId: newDevice() })).status).toBe(404);
    expect((await as(merge, "/api/admin/merge", { keepId: n })).status).toBe(400);
  });
});
