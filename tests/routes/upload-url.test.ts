import "./env";
import { beforeEach, describe, expect, it } from "vitest";
import { POST as nominate } from "@/app/api/nominate/route";
import { POST as uploadUrl } from "@/app/api/upload-url/route";
import { closeVoting, fillRateLimit, newDevice, openVoting, resetDb } from "../db/helpers";
import { call, post, putSigned } from "./request";

beforeEach(resetDb);

const issue = (device: string | null) => call(uploadUrl(post("/api/upload-url", { device })));

describe("POST /api/upload-url", () => {
  it("issues a path, without the device ID, that only this device can nominate with, once uploaded, once", async () => {
    await openVoting();
    const me = newDevice();
    const { status, body } = await issue(me);
    expect(status).toBe(200);
    expect(body.path).toMatch(/^guest\/[0-9a-f-]{36}\.jpg$/);
    expect(JSON.stringify(body)).not.toContain(me);

    const nom = (device: string) =>
      call(nominate(post("/api/nominate", { device, body: { categories: ["funniest"], photoPath: body.path } })));
    expect((await nom(me)).body.error).toBe("invalid_photo");
    await putSigned(body.signedUrl);
    expect((await nom(newDevice())).body.error).toBe("invalid_photo");
    expect((await nom(me)).status).toBe(201);
    expect((await nom(me)).body.error).toBe("invalid_photo");
  });

  it("is rejected before voting opens and after it closes", async () => {
    expect(await issue(newDevice())).toMatchObject({ status: 403, body: { error: "closed" } });
    await openVoting();
    await closeVoting();
    expect((await issue(newDevice())).status).toBe(403);
  });

  it("requires a device ID", async () => {
    await openVoting();
    expect((await issue(null)).status).toBe(400);
  });

  it("rate limits a device to 20 upload URLs per window", async () => {
    await openVoting();
    const me = newDevice();
    await fillRateLimit(me, "upload", 19);
    expect((await issue(me)).status).toBe(200);
    expect(await issue(me)).toMatchObject({ status: 429, body: { error: "rate_limited" } });
  });
});
