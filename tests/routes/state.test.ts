import "./env";
import { beforeEach, describe, expect, it } from "vitest";
import { GET } from "@/app/api/state/route";
import { closeVoting, openVoting, resetDb } from "../db/helpers";
import { call } from "./request";

beforeEach(resetDb);

describe("GET /api/state", () => {
  it("reports not_started before the host starts voting", async () => {
    const { status, body } = await call(GET());
    expect(status).toBe(200);
    expect(body).toMatchObject({ status: "not_started", votingOpensAt: null, votingClosesAt: null, resultsPublished: false });
    expect(Number.isNaN(Date.parse(body.serverNow))).toBe(false);
  });

  it("reports open with the close time, then closed", async () => {
    await openVoting(30);
    const open = (await call(GET())).body;
    expect(open.status).toBe("open");
    const minutesLeft = (Date.parse(open.votingClosesAt) - Date.parse(open.serverNow)) / 60000;
    expect(minutesLeft).toBeGreaterThan(29);
    expect(minutesLeft).toBeLessThanOrEqual(30);

    await closeVoting();
    expect((await call(GET())).body.status).toBe("closed");
  });
});
