import "./env";
import { beforeEach, describe, expect, it } from "vitest";
import { POST } from "@/app/api/add-to-category/route";
import {
  admin,
  categoriesOf,
  closeVoting,
  countRows,
  createNominee,
  fillRateLimit,
  newDevice,
  openVoting,
  resetDb,
} from "../db/helpers";
import { call, post } from "./request";

beforeEach(resetDb);

const add = (device: string | null, nomineeId: string, categories: string | string[]) =>
  call(
    POST(post("/api/add-to-category", { device, body: { nomineeId, categories: [categories].flat() } })),
  );

describe("POST /api/add-to-category", () => {
  it("adds an existing nominee to the category without a new photo, and logs the edit", async () => {
    await openVoting();
    const n = await createNominee(newDevice(), "most_unique", "Ana");
    expect(await add(newDevice(), n, "funniest")).toEqual({ status: 200, body: { ok: true } });
    expect(await categoriesOf(n)).toEqual(["funniest", "most_unique"]);
    expect(await countRows("nominee_edits")).toBe(1);
  });

  it("adds several categories in one edit, skipping ones the nominee already has", async () => {
    await openVoting();
    const n = await createNominee(newDevice(), "most_unique", "Ana");
    expect((await add(newDevice(), n, ["funniest", "most_unique", "best_couples"])).status).toBe(200);
    expect(await categoriesOf(n)).toEqual(["best_couples", "funniest", "most_unique"]);
    const { data } = await admin.from("nominee_edits").select("added_categories").eq("nominee_id", n);
    expect(data).toEqual([{ added_categories: ["best_couples", "funniest"] }]);
  });

  it("reports already_in_category (409), and hidden or unknown nominees (404)", async () => {
    await openVoting();
    const n = await createNominee(newDevice(), "funniest", "Ana");
    expect(await add(newDevice(), n, "funniest")).toMatchObject({ status: 409, body: { error: "already_in_category" } });
    expect((await add(newDevice(), newDevice(), "funniest")).status).toBe(404);
    await admin.from("nominees").update({ hidden: true }).eq("id", n);
    expect((await add(newDevice(), n, "most_unique")).status).toBe(404);
  });

  it("validates input and requires a device", async () => {
    await openVoting();
    const n = await createNominee(newDevice(), "funniest", "Ana");
    expect((await add(newDevice(), n, "scariest")).body.error).toBe("invalid_category");
    expect((await add(newDevice(), n, [])).body.error).toBe("invalid_category");
    expect((await add(newDevice(), n, ["most_unique", "scariest"])).body.error).toBe("invalid_category");
    expect((await add(newDevice(), "nope", "funniest")).body.error).toBe("invalid_request");
    expect((await add(null, n, "most_unique")).body.error).toBe("invalid_device");
  });

  it("is rejected after voting closes", async () => {
    await openVoting();
    const n = await createNominee(newDevice(), "funniest", "Ana");
    await closeVoting();
    expect(await add(newDevice(), n, "most_unique")).toMatchObject({ status: 403, body: { error: "closed" } });
  });

  it("shares the 10-per-window edit limit", async () => {
    await openVoting();
    const n = await createNominee(newDevice(), "funniest", "Ana");
    const me = newDevice();
    await fillRateLimit(me, "edit", 9);
    expect((await add(me, n, "most_unique")).status).toBe(200);
    expect((await add(me, n, "best_couples")).status).toBe(429);
  });

  it("counts several categories as one edit against the limit", async () => {
    await openVoting();
    const n = await createNominee(newDevice(), "funniest", "Ana");
    const me = newDevice();
    await fillRateLimit(me, "edit", 9);
    expect((await add(me, n, ["most_unique", "best_couples", "most_elaborate"])).status).toBe(200);
    expect(await categoriesOf(n)).toHaveLength(4);
    expect((await add(me, n, "funniest")).status).toBe(429);
  });
});
