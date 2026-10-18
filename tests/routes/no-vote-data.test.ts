// SPEC: guests never see vote counts, rankings, or other devices' votes. Seeds votes from
// several devices, calls every guest route, and checks each response's full shape against an
// allowlist. The only vote data allowed is /api/my-votes for the calling device. No response may
// contain any device ID, since a device ID is all it takes to read or change that device's votes.
import "./env";
import { beforeAll, describe, expect, it } from "vitest";
import { POST as addToCategory } from "@/app/api/add-to-category/route";
import { POST as edit } from "@/app/api/edit/route";
import { GET as myVotes } from "@/app/api/my-votes/route";
import { POST as nominate } from "@/app/api/nominate/route";
import { GET as nominees } from "@/app/api/nominees/route";
import { GET as state } from "@/app/api/state/route";
import { POST as uploadUrl } from "@/app/api/upload-url/route";
import { POST as vote } from "@/app/api/vote/route";
import { createNominee, newDevice, openVoting, resetDb, rpc, uploadPhoto } from "../db/helpers";
import { call, get, post } from "./request";

// Every leaf path in a JSON value: arrays become [], and keys under a dynamic map become *.
function shape(value: unknown, path = "", maps: string[] = []): string[] {
  if (Array.isArray(value)) return value.flatMap((v) => shape(v, `${path}[]`, maps));
  if (value && typeof value === "object") {
    const isMap = maps.includes(path);
    return Object.entries(value).flatMap(([k, v]) => shape(v, `${path ? `${path}.` : ""}${isMap ? "*" : k}`, maps));
  }
  return [path];
}

const NOMINEE = ["id", "personName", "costumeName", "categories[]", "photoUrl"];
const nomineeAt = (prefix: string) => NOMINEE.map((f) => `${prefix}[].${f}`);
const ERROR = ["error", "message"];
const ALLOWED: Record<string, string[]> = {
  state: ["status", "votingOpensAt", "votingClosesAt", "serverNow"],
  nominees: [
    ...nomineeAt("nominees"),
    ...nomineeAt("strips.here"),
    ...nomineeAt("strips.elsewhere"),
    ...nomineeAt("matches.here"),
    ...nomineeAt("matches.elsewhere"),
  ],
  myVotes: ["votes.*"],
  vote: ["ok"],
  uploadUrl: ["path", "signedUrl", "token"],
  nominate: ["id"],
  addToCategory: ["ok"],
  edit: ["ok"],
};
const VOTE_WORDS = /vote|count|rank|tally|score|total|winner|result/i;

// Every device that nominated or voted, including the caller.
const devices: string[] = [];
const device = () => {
  const d = newDevice();
  devices.push(d);
  return d;
};

function expectShape(route: string, body: unknown, allowed: string[], maps: string[] = []) {
  const text = JSON.stringify(body);
  for (const d of devices) expect(text, `${route}: contains device ID ${d}`).not.toContain(d);
  const paths = shape(body, "", maps);
  expect(paths.length, `${route} returned nothing`).toBeGreaterThan(0);
  for (const p of paths) expect([...allowed, ...ERROR], `${route}: unexpected field ${p}`).toContain(p);
  if (route !== "myVotes") {
    for (const p of paths) expect(p, `${route}: vote-like field ${p}`).not.toMatch(VOTE_WORDS);
  }
}

const me = device();
let ana: string, ben: string, cy: string;

beforeAll(async () => {
  await resetDb();
  await openVoting();
  // Added oldest to newest: Ana, Ben, Cy. Votes: Ben 3, Ana 2, Cy 0, so neither ranking
  // direction (Ben, Ana, Cy or Cy, Ana, Ben) matches the required newest-first Cy, Ben, Ana.
  ana = await createNominee(device(), ["funniest", "most_unique"], "Ana", "Witch");
  ben = await createNominee(device(), "funniest", "Ben", "Wizard");
  cy = await createNominee(device(), "funniest", "Cy");
  for (const [n, k] of [[ben, 3], [ana, 2]] as const) {
    for (let i = 0; i < k; i++) await rpc("cast_vote", { p_device: device(), p_category: "funniest", p_nominee: n });
  }
  await rpc("cast_vote", { p_device: me, p_category: "funniest", p_nominee: cy });
  await rpc("cast_vote", { p_device: device(), p_category: "most_unique", p_nominee: ana });
});

describe("guest responses contain no vote data", () => {
  it("GET /api/state", async () => {
    expectShape("state", (await call(state())).body, ALLOWED.state);
  });

  it("GET /api/nominees, ordered by time added, not votes", async () => {
    for (const c of ["funniest", "most_unique", "best_couples"]) {
      const { status, body } = await call(nominees(get(`/api/nominees?category=${c}&q=wi&q=an`, { device: me })));
      expect(status).toBe(200);
      expectShape("nominees", body, ALLOWED.nominees);
    }
    const { body } = await call(nominees(get("/api/nominees?category=funniest")));
    expect(body.nominees.map((n: { id: string }) => n.id)).toEqual([cy, ben, ana]);
    expect(body.strips.here.map((n: { id: string }) => n.id)).toEqual([cy, ben, ana]);
  });

  it("GET /api/my-votes returns only this device's own picks", async () => {
    const { body } = await call(myVotes(get("/api/my-votes", { device: me })));
    expectShape("myVotes", body, ALLOWED.myVotes, ["votes"]);
    expect(body).toEqual({ votes: { funniest: cy } });
  });

  it("every write route, on success and on rejection", async () => {
    const photoPath = await uploadPhoto(me);
    // Each request runs only after the previous one finishes, so a duplicate always sees the
    // first request's result.
    const requests: Array<[string, () => Response | Promise<Response>]> = [
      ["vote", () => vote(post("/api/vote", { device: me, body: { category: "funniest", nomineeId: ben } }))],
      ["vote", () => vote(post("/api/vote", { device: me, body: { category: "best_couples", nomineeId: ben } }))],
      ["uploadUrl", () => uploadUrl(post("/api/upload-url", { device: me }))],
      ["nominate", () => nominate(post("/api/nominate", { device: me, body: { categories: ["funniest"], photoPath } }))],
      ["nominate", () => nominate(post("/api/nominate", { device: me, body: { categories: [] } }))],
      ["addToCategory", () => addToCategory(post("/api/add-to-category", { device: me, body: { nomineeId: cy, category: "best_couples" } }))],
      ["addToCategory", () => addToCategory(post("/api/add-to-category", { device: me, body: { nomineeId: cy, category: "best_couples" } }))],
      ["edit", () => edit(post("/api/edit", { device: me, body: { nomineeId: ben, personName: "Benji", costumeName: "Wizard" } }))],
      ["edit", () => edit(post("/api/edit", { device: me, body: { nomineeId: ben, personName: "Benji", costumeName: "Wizard" } }))],
    ];
    const statuses: number[] = [];
    for (const [route, send] of requests) {
      const { status, body } = await call(send());
      statuses.push(status);
      expectShape(route, body, ALLOWED[route]);
    }
    // Both success and rejection bodies were inspected.
    expect(statuses).toEqual([200, 404, 200, 201, 400, 200, 409, 200, 409]);
  });
});
