import "../env";
import { beforeEach, describe, expect, it } from "vitest";
import { POST } from "@/app/api/admin/publish/route";
import { GET as state } from "@/app/api/state/route";
import { closeVoting, getSettings, openVoting, resetDb } from "../../db/helpers";
import { call, post } from "../request";

beforeEach(resetDb);

const publish = (body: unknown) => call(POST(post("/api/admin/publish", { admin: true, body })));
const published = async () => (await call(state())).body.resultsPublished;

describe("POST /api/admin/publish", () => {
  it("refuses to publish before voting starts or while it is open", async () => {
    expect(await publish({ published: true })).toMatchObject({ status: 409, body: { error: "not_closed" } });
    await openVoting();
    expect(await publish({ published: true })).toMatchObject({ status: 409, body: { error: "not_closed" } });
    expect(await published()).toBe(false);
  });

  it("publishes after close and unpublishes, shown in /api/state", async () => {
    await openVoting();
    await closeVoting();
    expect(await publish({ published: true })).toEqual({ status: 200, body: { resultsPublished: true } });
    expect(await published()).toBe(true);
    expect(await publish({ published: false })).toEqual({ status: 200, body: { resultsPublished: false } });
    expect(await published()).toBe(false);
  });

  it("validates the body without changing settings", async () => {
    const before = await getSettings();
    for (const body of [{}, { published: "yes" }, { published: 1 }]) {
      expect((await publish(body)).body.error, JSON.stringify(body)).toBe("invalid_request");
    }
    expect(await getSettings()).toEqual(before);
  });
});
