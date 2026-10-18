import "./env";
import { beforeEach, describe, expect, it } from "vitest";
import { GET } from "@/app/api/my-votes/route";
import { admin, createNominee, newDevice, openVoting, resetDb, rpc } from "../db/helpers";
import { call, get } from "./request";

beforeEach(async () => {
  await resetDb();
  await openVoting();
});

const vote = (device: string, category: string, nominee: string) =>
  rpc("cast_vote", { p_device: device, p_category: category, p_nominee: nominee });

describe("GET /api/my-votes", () => {
  it("requires a device ID", async () => {
    const { status, body } = await call(GET(get("/api/my-votes")));
    expect(status).toBe(400);
    expect(body.error).toBe("invalid_device");
  });

  it("returns only this device's picks, by category", async () => {
    const me = newDevice();
    const a = await createNominee(newDevice(), ["funniest", "most_unique"], "Ana");
    const b = await createNominee(newDevice(), "funniest", "Ben");
    await vote(me, "funniest", a);
    await vote(me, "funniest", b);
    await vote(me, "most_unique", a);
    await vote(newDevice(), "funniest", a);

    const { status, body } = await call(GET(get("/api/my-votes", { device: me })));
    expect(status).toBe(200);
    expect(body).toEqual({ votes: { funniest: b, most_unique: a } });
    expect((await call(GET(get("/api/my-votes", { device: newDevice() })))).body).toEqual({ votes: {} });
  });

  it("reads the device from the cookie fallback", async () => {
    const me = newDevice();
    const a = await createNominee(newDevice(), "funniest", "Ana");
    await vote(me, "funniest", a);
    const { body } = await call(GET(get("/api/my-votes", { cookie: `device_id=${me}` })));
    expect(body).toEqual({ votes: { funniest: a } });
  });

  it("leaves out votes for hidden nominees", async () => {
    const me = newDevice();
    const a = await createNominee(newDevice(), "funniest", "Ana");
    const b = await createNominee(newDevice(), "most_unique", "Ben");
    await vote(me, "funniest", a);
    await vote(me, "most_unique", b);
    await admin.from("nominees").update({ hidden: true }).eq("id", a);
    const { body } = await call(GET(get("/api/my-votes", { device: me })));
    expect(body).toEqual({ votes: { most_unique: b } });
  });
});
