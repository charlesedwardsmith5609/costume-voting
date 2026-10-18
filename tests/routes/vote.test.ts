import "./env";
import { beforeEach, describe, expect, it } from "vitest";
import { POST } from "@/app/api/vote/route";
import {
  admin,
  closeVoting,
  createNominee,
  fillRateLimit,
  newDevice,
  openVoting,
  resetDb,
  seedNominee,
  votesFor,
} from "../db/helpers";
import { call, post } from "./request";

beforeEach(resetDb);

const vote = (device: string | null, category: string, nomineeId: string) =>
  call(POST(post("/api/vote", { device, body: { category, nomineeId } })));

describe("POST /api/vote", () => {
  it("is rejected before voting opens and after it closes", async () => {
    const n = await seedNominee(["funniest"]);
    expect(await vote(newDevice(), "funniest", n)).toMatchObject({ status: 403, body: { error: "closed" } });
    await openVoting();
    await closeVoting();
    expect((await vote(newDevice(), "funniest", n)).status).toBe(403);
    expect(await votesFor(n)).toBe(0);
  });

  it("changing a vote moves one vote", async () => {
    await openVoting();
    const a = await createNominee(newDevice(), "funniest", "Ana");
    const b = await createNominee(newDevice(), "funniest", "Ben");
    const me = newDevice();
    expect(await vote(me, "funniest", a)).toEqual({ status: 200, body: { ok: true } });
    expect((await vote(me, "funniest", b)).status).toBe(200);
    expect(await votesFor(a)).toBe(0);
    expect(await votesFor(b)).toBe(1);
  });

  it("rejects hidden, wrong-category, and unknown nominees with 404", async () => {
    await openVoting();
    const n = await createNominee(newDevice(), "funniest", "Ana");
    expect((await vote(newDevice(), "most_unique", n)).body.error).toBe("invalid_nominee");
    expect((await vote(newDevice(), "funniest", newDevice())).status).toBe(404);
    await admin.from("nominees").update({ hidden: true }).eq("id", n);
    expect((await vote(newDevice(), "funniest", n)).status).toBe(404);
  });

  it("rejects bad input and a missing device with 400", async () => {
    await openVoting();
    const n = await createNominee(newDevice(), "funniest", "Ana");
    expect((await vote(null, "funniest", n)).body.error).toBe("invalid_device");
    expect((await vote(newDevice(), "scariest", n)).body.error).toBe("invalid_category");
    expect((await vote(newDevice(), "funniest", "nope")).body.error).toBe("invalid_request");
    const raw = await call(POST(post("/api/vote", { device: newDevice(), rawBody: "{not json" })));
    expect(raw.status).toBe(400);
  });

  it("rate limits a device to 60 vote requests per window", async () => {
    await openVoting();
    const n = await createNominee(newDevice(), "funniest", "Ana");
    const me = newDevice();
    await fillRateLimit(me, "vote", 59);
    expect((await vote(me, "funniest", n)).status).toBe(200);
    expect(await vote(me, "funniest", n)).toMatchObject({ status: 429, body: { error: "rate_limited" } });
  });
});
