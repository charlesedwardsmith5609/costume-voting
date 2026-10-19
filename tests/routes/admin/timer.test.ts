import "../env";
import { beforeEach, describe, expect, it } from "vitest";
import { POST } from "@/app/api/admin/timer/route";
import { getSettings, openVoting, resetDb, rpc } from "../../db/helpers";
import { call, post } from "../request";

beforeEach(resetDb);

const timer = (body: Record<string, unknown>) => call(POST(post("/api/admin/timer", { admin: true, body })));
const minutesFromNow = (iso: string) => (Date.parse(iso) - Date.now()) / 60000;
const isOpen = () => rpc<boolean>("voting_is_open");

// An ISO time `min` minutes from now in a fixed -07:00 offset, as a Pacific browser would send.
function pacific(min: number): string {
  const d = new Date(Date.now() + min * 60000 - 7 * 3600_000);
  return d.toISOString().replace(/\.\d{3}Z$/, "-07:00");
}

describe("POST /api/admin/timer", () => {
  it("starts with a duration", async () => {
    const { status, body } = await timer({ action: "start", minutes: 30 });
    expect(status).toBe(200);
    expect(minutesFromNow(body.votingClosesAt)).toBeGreaterThan(29);
    expect(minutesFromNow(body.votingClosesAt)).toBeLessThan(31);
    expect(await isOpen()).toBe(true);
  });

  it("starts with an absolute close time given with an offset", async () => {
    const closesAt = pacific(90);
    const { status, body } = await timer({ action: "start", closesAt });
    expect(status).toBe(200);
    expect(Math.abs(Date.parse(body.votingClosesAt) - Date.parse(closesAt))).toBeLessThan(1000);
    expect(await isOpen()).toBe(true);
  });

  it("rejects close times without an offset, in the past, too far ahead, or with minutes", async () => {
    const before = await getSettings();
    const noOffset = new Date(Date.now() + 3600_000).toISOString().replace("Z", "");
    for (const body of [
      { action: "start", closesAt: noOffset },
      { action: "start", closesAt: "10:30 PM" },
      { action: "start", closesAt: pacific(-5) },
      { action: "start", closesAt: pacific(601) },
      { action: "start", closesAt: pacific(60), minutes: 30 },
      { action: "start" },
      { action: "start", minutes: 0 },
      { action: "start", minutes: 1.5 },
      { action: "extend" },
      { action: "pause" },
    ]) {
      expect(await timer(body), JSON.stringify(body)).toMatchObject({ status: 400, body: { error: "invalid_timer" } });
    }
    expect(await getSettings()).toEqual(before);
  });

  it("extend and end report not_started (409) before the timer starts", async () => {
    expect(await timer({ action: "extend", minutes: 5 })).toMatchObject({ status: 409, body: { error: "not_started" } });
    expect((await timer({ action: "end" })).status).toBe(409);
  });

  it("extends, ends, and reopens", async () => {
    await openVoting(30);
    const ext = await timer({ action: "extend", minutes: 10 });
    expect(minutesFromNow(ext.body.votingClosesAt)).toBeGreaterThan(39);
    expect((await timer({ action: "end" })).status).toBe(200);
    expect(await isOpen()).toBe(false);
    expect((await timer({ action: "start", closesAt: pacific(30) })).status).toBe(200);
    expect(await isOpen()).toBe(true);
  });
});
