import "../env";
import { beforeEach, describe, expect, it } from "vitest";
import { GET as read, POST as send } from "@/app/api/admin/reveal-remote/route";
import { POST as publish } from "@/app/api/admin/reveal-state/route";
import { admin, getSettings, openVoting, resetDb, rpc } from "../../db/helpers";
import { call, get, post } from "../request";

beforeEach(resetDb);

const state = { step: "category", index: 1, count: 4, label: "Funniest", revealed: false, rolling: false, muted: false, winners: ["Sam"] };
const status = async () => (await call(read(get("/api/admin/reveal-remote", { admin: true })))).body;
const command = (c: unknown) => call(send(post("/api/admin/reveal-remote", { admin: true, body: { command: c } })));
const publishState = (s: unknown) => call(publish(post("/api/admin/reveal-state", { admin: true, body: { state: s } })));

describe("reveal remote routes", () => {
  it("counts commands in order and returns the last one", async () => {
    const start = (await status()).seq;
    expect((await command("reveal")).body.seq).toBe(start + 1);
    expect((await command("next")).body.seq).toBe(start + 2);
    expect(await status()).toMatchObject({ seq: start + 2, command: "next" });
  });

  it("rejects an unknown command without counting it", async () => {
    const start = (await status()).seq;
    expect((await command("reset")).status).toBe(400);
    expect((await command(undefined)).status).toBe(400);
    expect((await status()).seq).toBe(start);
  });

  it("stores the TV status and reports the TV as connected", async () => {
    expect((await status()).tvConnected).toBe(false);
    expect((await publishState(state)).status).toBe(200);
    expect(await status()).toMatchObject({ state, tvConnected: true });
  });

  it("reports the TV as gone when its status is old", async () => {
    await publishState(state);
    await admin.from("reveal_remote").update({ state_at: new Date(Date.now() - 60_000).toISOString() }).eq("id", 1);
    expect((await status()).tvConnected).toBe(false);
  });

  it("rejects a malformed status", async () => {
    expect((await publishState({ ...state, step: "other" })).status).toBe(400);
    expect((await publishState("x")).status).toBe(400);
  });

  it("is cleared by reset, but the counter keeps counting", async () => {
    await command("reveal");
    await publishState(state);
    const before = (await status()).seq;
    await resetDb();
    expect(await status()).toMatchObject({ seq: before, command: null, state: null, tvConnected: false });
  });

  it("send_reveal_command is the only writer of seq", async () => {
    const out = await rpc<{ status: string }>("send_reveal_command", { p_command: "bogus" });
    expect(out.status).toBe("invalid");
  });
});

describe("reset_all and publishing", () => {
  it("unpublishes results", async () => {
    await openVoting();
    await rpc("set_timer", { p_action: "end" });
    await rpc("set_results_published", { p_published: true });
    await resetDb();
    const { data } = await admin.from("settings").select("results_published_at").single();
    expect(data?.results_published_at).toBeNull();
    expect(await getSettings()).toEqual({ voting_opens_at: null, voting_closes_at: null });
  });
});
