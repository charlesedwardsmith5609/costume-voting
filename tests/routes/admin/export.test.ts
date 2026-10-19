import "../env";
import { beforeEach, describe, expect, it } from "vitest";
import { GET } from "@/app/api/admin/export/route";
import { CSV_HEADER } from "@/lib/server/results";
import { admin, createNominee, newDevice, openVoting, resetDb, rpc } from "../../db/helpers";
import { get } from "../request";

beforeEach(async () => {
  await resetDb();
  await openVoting();
});

// Response.text() drops a leading BOM, so read the bytes to check it is there.
async function readCsv(res: Response): Promise<string> {
  const bytes = new Uint8Array(await res.arrayBuffer());
  expect([...bytes.slice(0, 3)]).toEqual([0xef, 0xbb, 0xbf]);
  return new TextDecoder("utf-8", { ignoreBOM: true }).decode(bytes).slice(1);
}

const vote = (category: string, nominee: string) =>
  rpc("cast_vote", { p_device: newDevice(), p_category: category, p_nominee: nominee });

describe("GET /api/admin/export", () => {
  it("downloads one row per nominee per category with dense ranks and hidden nominees last", async () => {
    const al = await createNominee(newDevice(), ["funniest", "most_unique"], "Al", "Pirate");
    const bo = await createNominee(newDevice(), "funniest", "Bo");
    const cy = await createNominee(newDevice(), "funniest", "Cy");
    const hid = await createNominee(newDevice(), "funniest", "=cmd");
    for (const n of [al, al, bo, bo, cy, hid, hid, hid]) await vote("funniest", n);
    await admin.from("nominees").update({ hidden: true }).eq("id", hid);

    const res = await GET(get("/api/admin/export", { admin: true }));
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toBe("text/csv; charset=utf-8");
    expect(res.headers.get("content-disposition")).toBe('attachment; filename="costume-results.csv"');

    const text = await readCsv(res);
    const rows = text.trimEnd().split("\r\n").map((l) => l.split(","));
    expect(rows[0]).toEqual(CSV_HEADER);
    // category, rank, display label, person, costume, votes, hidden
    expect(rows.slice(1).map((r) => r.slice(0, 7))).toEqual([
      ["Most Unique", "1", "Al as Pirate", "Al", "Pirate", "0", "false"],
      ["Funniest", "1", "Al as Pirate", "Al", "Pirate", "2", "false"],
      ["Funniest", "1", "Bo", "Bo", "", "2", "false"],
      ["Funniest", "2", "Cy", "Cy", "", "1", "false"],
      ["Funniest", "", "'=cmd", "'=cmd", "", "3", "true"],
    ]);
    expect(rows[1][7]).toMatch(/^https:\/\/.+\/storage\/v1\/object\/public\/nominee-photos\/guest\/.+\.jpg$/);
  });

  it("is a header-only file when there are no nominees", async () => {
    const text = await readCsv(await GET(get("/api/admin/export", { admin: true })));
    expect(text).toBe(`${CSV_HEADER.join(",")}\r\n`);
  });
});
