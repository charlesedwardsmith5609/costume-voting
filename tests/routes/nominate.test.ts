import "./env";
import { beforeEach, describe, expect, it } from "vitest";
import { GET as list } from "@/app/api/nominees/route";
import { POST } from "@/app/api/nominate/route";
import {
  categoriesOf,
  closeVoting,
  fillRateLimit,
  getNominee,
  newDevice,
  openVoting,
  resetDb,
  uploadPhoto,
} from "../db/helpers";
import { call, get, post } from "./request";

beforeEach(resetDb);

const nominate = (device: string | null, body: Record<string, unknown>) => call(POST(post("/api/nominate", { device, body })));

describe("POST /api/nominate", () => {
  it("creates a nominee in every chosen category with trimmed names, visible in each", async () => {
    await openVoting();
    const me = newDevice();
    const res = await nominate(me, {
      categories: ["funniest", "best_couples", "funniest"],
      personName: "  Sam ",
      costumeName: "The Mad Hatter",
      photoPath: await uploadPhoto(me),
    });
    expect(res.status).toBe(201);
    expect(Object.keys(res.body)).toEqual(["id"]);
    expect(await categoriesOf(res.body.id)).toEqual(["best_couples", "funniest"]);
    expect(await getNominee(res.body.id)).toMatchObject({ person_name: "Sam", costume_name: "The Mad Hatter" });
    for (const c of ["funniest", "best_couples"]) {
      const { body } = await call(list(get(`/api/nominees?category=${c}`)));
      expect(body.nominees.map((n: { id: string }) => n.id)).toEqual([res.body.id]);
    }
  });

  it("allows a photo-only nominee", async () => {
    await openVoting();
    const me = newDevice();
    const res = await nominate(me, { categories: ["funniest"], personName: " ", photoPath: await uploadPhoto(me) });
    expect(res.status).toBe(201);
    expect(await getNominee(res.body.id)).toMatchObject({ person_name: null, costume_name: null });
  });

  it("is rejected before voting opens and after it closes", async () => {
    const me = newDevice();
    const photoPath = await uploadPhoto(me);
    expect(await nominate(me, { categories: ["funniest"], photoPath })).toMatchObject({ status: 403 });
    await openVoting();
    await closeVoting();
    expect((await nominate(me, { categories: ["funniest"], photoPath })).body.error).toBe("closed");
  });

  it("validates categories, names, photo, and device", async () => {
    await openVoting();
    const me = newDevice();
    const photoPath = await uploadPhoto(me);
    expect((await nominate(me, { categories: [], photoPath })).body.error).toBe("invalid_category");
    expect((await nominate(me, { categories: ["scariest"], photoPath })).body.error).toBe("invalid_category");
    expect((await nominate(me, { categories: "funniest", photoPath })).status).toBe(400);
    expect((await nominate(me, { categories: ["funniest"], personName: "x".repeat(61), photoPath })).body.error).toBe(
      "invalid_name",
    );
    expect((await nominate(me, { categories: ["funniest"], costumeName: 42, photoPath })).status).toBe(400);
    expect((await nominate(me, { categories: ["funniest"] })).body.error).toBe("invalid_photo");
    expect((await nominate(me, { categories: ["funniest"], photoPath: await uploadPhoto(newDevice()) })).status).toBe(400);
    expect((await nominate(null, { categories: ["funniest"], photoPath })).body.error).toBe("invalid_device");
    // 60 emoji are 60 characters, not 120 UTF-16 units.
    expect((await nominate(me, { categories: ["funniest"], personName: "🎃".repeat(60), photoPath })).status).toBe(201);
  });

  it("rate limits a device to 10 nominations per window", async () => {
    await openVoting();
    const me = newDevice();
    await fillRateLimit(me, "nominate", 9);
    expect((await nominate(me, { categories: ["funniest"], photoPath: await uploadPhoto(me) })).status).toBe(201);
    const res = await nominate(me, { categories: ["funniest"], photoPath: await uploadPhoto(me) });
    expect(res).toMatchObject({ status: 429, body: { error: "rate_limited" } });
  });
});
