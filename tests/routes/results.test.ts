import "./env";
import { beforeEach, describe, expect, it } from "vitest";
import { GET } from "@/app/api/results/route";
import { admin, closeVoting, createNominee, newDevice, openVoting, resetDb, rpc } from "../db/helpers";
import { call } from "./request";

beforeEach(async () => {
  await resetDb();
  await openVoting();
});

const vote = (device: string, category: string, nominee: string) =>
  rpc("cast_vote", { p_device: device, p_category: category, p_nominee: nominee });
const publish = (p_published: boolean) => rpc("set_results_published", { p_published });
const results = () => call(GET());
type Entry = { personName: string; rank?: number };

describe("GET /api/results", () => {
  it("is 403 not_published while voting is open, after close until published, and after unpublishing", async () => {
    expect(await results()).toMatchObject({ status: 403, body: { error: "not_published" } });
    await closeVoting();
    expect((await results()).status).toBe(403);
    await publish(true);
    expect((await results()).status).toBe(200);
    await publish(false);
    expect((await results()).status).toBe(403);
  });

  it("is hidden again when the host reopens voting", async () => {
    await closeVoting();
    await publish(true);
    await rpc("set_timer", { p_action: "extend", p_minutes: 5 });
    expect((await results()).status).toBe(403);
  });

  it("ranks nominees with votes (ties share a rank), lists the rest as also nominated, and leaves out hidden ones", async () => {
    const [al, bo, cy] = [
      await createNominee(newDevice(), "funniest", "Al"),
      await createNominee(newDevice(), "funniest", "Bo"),
      await createNominee(newDevice(), "funniest", "Cy"),
    ];
    await createNominee(newDevice(), "funniest", "Zed");
    await createNominee(newDevice(), "funniest", "Dee");
    const hidden = await createNominee(newDevice(), "funniest", "Hal");
    for (const n of [al, al, bo, bo, cy, hidden, hidden, hidden]) await vote(newDevice(), "funniest", n);
    await admin.from("nominees").update({ hidden: true }).eq("id", hidden);
    await closeVoting();
    await publish(true);

    const { status, body } = await results();
    expect(status).toBe(200);
    expect(body.categories.map((c: { category: string }) => c.category)).toEqual([
      "most_elaborate",
      "most_unique",
      "funniest",
      "best_couples",
    ]);
    const funniest = body.categories.find((c: { category: string }) => c.category === "funniest");
    expect(funniest.ranked.map((n: Entry) => [n.personName, n.rank])).toEqual([
      ["Al", 1],
      ["Bo", 1],
      ["Cy", 2],
    ]);
    expect(funniest.alsoNominated.map((n: Entry) => n.personName)).toEqual(["Dee", "Zed"]);
    expect(JSON.stringify(body)).not.toMatch(/"votes"|Hal/);
    expect(body.categories[0]).toMatchObject({ category: "most_elaborate", ranked: [], alsoNominated: [] });
  });
});
