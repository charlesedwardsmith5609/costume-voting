import "../env";
import { beforeEach, describe, expect, it } from "vitest";
import { GET } from "@/app/api/admin/results/route";
import { admin, createNominee, newDevice, openVoting, resetDb, rpc } from "../../db/helpers";
import { call, get } from "../request";

beforeEach(async () => {
  await resetDb();
  await openVoting();
});

const vote = (device: string, category: string, nominee: string) =>
  rpc("cast_vote", { p_device: device, p_category: category, p_nominee: nominee });
const results = async () => (await call(GET(get("/api/admin/results", { admin: true })))).body;

describe("GET /api/admin/results", () => {
  it("ranks per category with dense ranks, totals, photos, and distinct devices", async () => {
    const [al, bo, cy] = [
      await createNominee(newDevice(), "funniest", "Al"),
      await createNominee(newDevice(), ["funniest", "most_unique"], "Bo"),
      await createNominee(newDevice(), "funniest", "Cy"),
    ];
    const [d1, d2, d3, d4, d5] = Array.from({ length: 5 }, newDevice);
    await vote(d1, "funniest", al);
    await vote(d2, "funniest", al);
    await vote(d3, "funniest", bo);
    await vote(d4, "funniest", bo);
    await vote(d5, "funniest", cy);
    await vote(d1, "most_unique", bo);

    const body = await results();
    expect(body.distinctDevices).toBe(5);
    const funniest = body.categories.find((c: { category: string }) => c.category === "funniest");
    expect(funniest.totalVotes).toBe(5);
    expect(funniest.nominees.map((n: { label: string; votes: number; rank: number }) => [n.label, n.votes, n.rank])).toEqual([
      ["Al", 2, 1],
      ["Bo", 2, 1],
      ["Cy", 1, 2],
    ]);
    expect(funniest.nominees[0].photoUrl).toMatch(/\/storage\/v1\/object\/public\/nominee-photos\/guest\/.+\.jpg$/);
    const elaborate = body.categories.find((c: { category: string }) => c.category === "most_elaborate");
    expect(elaborate).toMatchObject({ totalVotes: 0, nominees: [] });
  });

  it("leaves out hidden nominees and their votes", async () => {
    const al = await createNominee(newDevice(), "funniest", "Al");
    const hid = await createNominee(newDevice(), "funniest", "Hid");
    await vote(newDevice(), "funniest", al);
    const hider = newDevice();
    await vote(hider, "funniest", hid);
    await vote(newDevice(), "funniest", hid);
    await admin.from("nominees").update({ hidden: true }).eq("id", hid);

    const body = await results();
    const funniest = body.categories.find((c: { category: string }) => c.category === "funniest");
    expect(funniest.nominees.map((n: { id: string }) => n.id)).toEqual([al]);
    expect(funniest.totalVotes).toBe(1);
    expect(body.distinctDevices).toBe(1);
  });
});
