import "./env";
import { beforeEach, describe, expect, it } from "vitest";
import { GET } from "@/app/api/nominees/route";
import { admin, createNominee, newDevice, openVoting, resetDb, rpc } from "../db/helpers";
import { call, get } from "./request";

beforeEach(async () => {
  await resetDb();
  await openVoting();
});

const list = (query: string) => call(GET(get(`/api/nominees?${query}`)));

describe("GET /api/nominees", () => {
  it("rejects an unknown or empty category", async () => {
    expect((await list("category=scariest")).body.error).toBe("invalid_category");
    expect((await list("category=")).status).toBe(400);
  });

  it("without a category, lists every non-hidden nominee newest first, with its categories", async () => {
    const a = await createNominee(newDevice(), "funniest", "Ana");
    const b = await createNominee(newDevice(), ["most_unique", "best_couples"], "Ben");
    const hidden = await createNominee(newDevice(), "most_elaborate", "Hal");
    await admin.from("nominees").update({ hidden: true }).eq("id", hidden);

    const { status, body } = await list("");
    expect(status).toBe(200);
    expect(Object.keys(body)).toEqual(["nominees"]);
    expect(body.nominees.map((n: { id: string }) => n.id)).toEqual([b, a]);
    expect(body.nominees[0].categories).toEqual(["most_unique", "best_couples"]);
    expect(body.nominees[0].thumbUrl).toMatch(/\.thumb\.jpg$/);
  });

  it("without a category, orders by creation, not by when a category was last added", async () => {
    const device = newDevice();
    const old = await createNominee(device, "most_unique", "Old");
    const recent = await createNominee(device, "funniest", "New");
    await rpc("add_nominee_to_categories", { p_device: device, p_nominee: old, p_categories: ["funniest"] });
    expect((await list("")).body.nominees.map((n: { id: string }) => n.id)).toEqual([recent, old]);
  });

  it("lists non-hidden nominees in the category, newest first, with public photo URLs", async () => {
    const a = await createNominee(newDevice(), "funniest", "Ana");
    const b = await createNominee(newDevice(), ["funniest", "most_unique"], "Ben");
    const hidden = await createNominee(newDevice(), "funniest", "Hal");
    await createNominee(newDevice(), "most_unique", "Cy");
    await admin.from("nominees").update({ hidden: true }).eq("id", hidden);

    const { status, body } = await list("category=funniest");
    expect(status).toBe(200);
    expect(body.nominees.map((n: { id: string }) => n.id)).toEqual([b, a]);
    expect(body.nominees[0].categories).toEqual(["most_unique", "funniest"]);
    expect(body.nominees[0].photoUrl).toMatch(/\/storage\/v1\/object\/public\/nominee-photos\/.+\.jpg$/);
    expect(body.strips.elsewhere.map((n: { personName: string }) => n.personName)).toEqual(["Cy"]);
  });

  it("an added category puts the nominee at the top of that category", async () => {
    const device = newDevice();
    const old = await createNominee(device, "most_unique", "Old");
    await createNominee(device, "funniest", "New");
    await rpc("add_nominee_to_category", { p_device: device, p_nominee: old, p_category: "funniest" });
    const { body } = await list("category=funniest");
    expect(body.nominees.map((n: { personName: string }) => n.personName)).toEqual(["Old", "New"]);
  });

  it("returns name matches in and outside the category, never photo-only nominees", async () => {
    await createNominee(newDevice(), "funniest", "Sam", "The Mad Hatter");
    await createNominee(newDevice(), "most_unique", null, "Mad Max");
    await createNominee(newDevice(), "funniest", null, null);

    const { body } = await list("category=funniest&q=MAD");
    expect(body.matches.here.map((n: { costumeName: string }) => n.costumeName)).toEqual(["The Mad Hatter"]);
    expect(body.matches.elsewhere.map((n: { costumeName: string }) => n.costumeName)).toEqual(["Mad Max"]);
    expect((await list("category=funniest")).body.matches).toBeUndefined();
  });
});
