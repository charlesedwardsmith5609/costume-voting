import { beforeEach, describe, expect, it } from "vitest";
import {
  admin,
  categoriesOf,
  closeVoting,
  countRows,
  createNominee,
  getNominee,
  getSettings,
  newDevice,
  openVoting,
  resetDb,
  rpc,
  seedNominee,
  type Status,
  uploadPhoto,
  votesFor,
} from "./helpers";

type TimerResult = { status: string; voting_opens_at?: string; voting_closes_at?: string };

const vote = (device: string, category: string, nominee: string) =>
  rpc<string>("cast_vote", { p_device: device, p_category: category, p_nominee: nominee });

const nominate = (
  device: string,
  categories: string[] | null,
  person: string | null,
  costume: string | null,
  photo: string,
) =>
  rpc<Status>("create_nominee", {
    p_device: device,
    p_categories: categories,
    p_person_name: person,
    p_costume_name: costume,
    p_photo_path: photo,
  });

const addToCategory = (device: string, nominee: string, category: string) =>
  rpc<Status>("add_nominee_to_category", { p_device: device, p_nominee: nominee, p_category: category });

type EditFields = { person?: string | null; costume?: string | null; photo?: string | null; add?: string[] };

// Edits default to the nominee's current names, like the edit form, which sends every field.
async function editArgs(nominee: string, f: EditFields) {
  const needsCurrent = f.person === undefined || f.costume === undefined;
  const cur = needsCurrent ? await getNominee(nominee) : { person_name: null, costume_name: null };
  return {
    p_nominee: nominee,
    p_person_name: f.person === undefined ? cur.person_name : f.person,
    p_costume_name: f.costume === undefined ? cur.costume_name : f.costume,
    p_photo_path: f.photo ?? null,
    p_add_categories: f.add ?? [],
  };
}

const edit = async (device: string, nominee: string, f: EditFields) =>
  rpc<Status>("edit_nominee", { p_device: device, ...(await editArgs(nominee, f)) });

const hostEdit = async (nominee: string, f: EditFields) =>
  rpc<Status>("admin_edit_nominee", await editArgs(nominee, f));

const setCategory = (nominee: string, category: string, present: boolean) =>
  rpc<Status>("admin_set_category", { p_nominee: nominee, p_category: category, p_present: present });

const undo = (editId: number) => rpc<Status>("undo_nominee_edit", { p_edit_id: editId });

const merge = (keep: string, drop: string) => rpc<Status>("merge_nominees", { p_keep: keep, p_drop: drop });

async function editsOf(nominee: string) {
  const { data, error } = await admin
    .from("nominee_edits")
    .select("*")
    .eq("nominee_id", nominee)
    .order("id");
  if (error) throw new Error(error.message);
  return data;
}

const minutesFromNow = (iso: string) => (new Date(iso).getTime() - Date.now()) / 60000;

beforeEach(resetDb);

describe("cast_vote", () => {
  it("rejects votes before the timer starts", async () => {
    // Nominating is also closed, so seed the nominee directly.
    const n = await seedNominee(["funniest"]);
    expect(await vote(newDevice(), "funniest", n)).toBe("closed");
    expect(await votesFor(n)).toBe(0);
  });

  it("rejects votes after the timer ends", async () => {
    await openVoting();
    const n = await createNominee(newDevice(), "funniest");
    await closeVoting();
    expect(await vote(newDevice(), "funniest", n)).toBe("closed");
    expect(await votesFor(n)).toBe(0);
  });

  it("changing a vote moves it instead of adding a second one", async () => {
    await openVoting();
    const host = newDevice();
    const a = await createNominee(host, "most_unique", "Alex");
    const b = await createNominee(host, "most_unique", "Blair");
    const guest = newDevice();

    expect(await vote(guest, "most_unique", a)).toBe("ok");
    expect(await votesFor(a)).toBe(1);
    expect(await vote(guest, "most_unique", b)).toBe("ok");
    expect(await votesFor(a)).toBe(0);
    expect(await votesFor(b)).toBe(1);
  });

  it("allows one vote per category for the same device", async () => {
    await openVoting();
    const host = newDevice();
    const a = await createNominee(host, "funniest", "Alex");
    const b = await createNominee(host, "most_elaborate", "Blair");
    const guest = newDevice();
    expect(await vote(guest, "funniest", a)).toBe("ok");
    expect(await vote(guest, "most_elaborate", b)).toBe("ok");
    expect(await votesFor(a)).toBe(1);
    expect(await votesFor(b)).toBe(1);
  });

  it("lets one device vote for the same multi-category nominee in each of its categories", async () => {
    await openVoting();
    const n = await createNominee(newDevice(), ["funniest", "most_unique"]);
    const guest = newDevice();
    expect(await vote(guest, "funniest", n)).toBe("ok");
    expect(await vote(guest, "most_unique", n)).toBe("ok");
    expect(await votesFor(n, "funniest")).toBe(1);
    expect(await votesFor(n, "most_unique")).toBe(1);
  });

  it("rejects nominees not in that category, unknown nominees, and hidden nominees in every category", async () => {
    await openVoting();
    const n = await createNominee(newDevice(), ["funniest", "most_elaborate"]);
    const guest = newDevice();

    expect(await vote(guest, "most_unique", n)).toBe("invalid_nominee");
    expect(await vote(guest, "funniest", newDevice())).toBe("invalid_nominee");

    await admin.from("nominees").update({ hidden: true }).eq("id", n);
    expect(await vote(guest, "funniest", n)).toBe("invalid_nominee");
    expect(await vote(guest, "most_elaborate", n)).toBe("invalid_nominee");
    expect(await votesFor(n)).toBe(0);
  });

  it("rate limits a device to 60 vote requests per window", { timeout: 60000 }, async () => {
    await openVoting();
    const n = await createNominee(newDevice(), "funniest");
    const guest = newDevice();
    for (let i = 0; i < 60; i++) expect(await vote(guest, "funniest", n)).toBe("ok");
    expect(await vote(guest, "funniest", n)).toBe("rate_limited");
    // Other devices are unaffected.
    expect(await vote(newDevice(), "funniest", n)).toBe("ok");
  });

  it("counts rejected requests toward the limit", { timeout: 60000 }, async () => {
    // Timer never started, so every request is rejected as closed.
    const guest = newDevice();
    const fake = newDevice();
    for (let i = 0; i < 60; i++) expect(await vote(guest, "funniest", fake)).toBe("closed");
    expect(await vote(guest, "funniest", fake)).toBe("rate_limited");
  });
});

describe("create_nominee", () => {
  it("creates a nominee in every chosen category with trimmed names", async () => {
    await openVoting();
    const device = newDevice();
    const photo = await uploadPhoto(device);
    const res = await nominate(device, ["best_couples", "funniest", "funniest"], "  Pat & Jo ", " salt and pepper ", photo);
    expect(res.status).toBe("ok");
    expect(await getNominee(res.id!)).toEqual({
      person_name: "Pat & Jo",
      costume_name: "salt and pepper",
      photo_path: photo,
      hidden: false,
    });
    expect(await categoriesOf(res.id!)).toEqual(["best_couples", "funniest"]);
  });

  it("stores blank names as null, so photo-only nominees are allowed", async () => {
    await openVoting();
    const device = newDevice();
    const res = await nominate(device, ["funniest"], "   ", null, await uploadPhoto(device));
    expect(res.status).toBe("ok");
    const n = await getNominee(res.id!);
    expect(n.person_name).toBeNull();
    expect(n.costume_name).toBeNull();
  });

  it("rejects nominations when voting is not open", async () => {
    const device = newDevice();
    const photo = await uploadPhoto(device);
    expect((await nominate(device, ["funniest"], "Alex", null, photo)).status).toBe("closed");
    await openVoting();
    await closeVoting();
    expect((await nominate(device, ["funniest"], "Alex", null, photo)).status).toBe("closed");
  });

  it("validates categories and names", async () => {
    await openVoting();
    const device = newDevice();
    const photo = await uploadPhoto(device);
    expect((await nominate(device, ["scariest"], "Alex", null, photo)).status).toBe("invalid_category");
    expect((await nominate(device, ["funniest", "scariest"], "Alex", null, photo)).status).toBe("invalid_category");
    expect((await nominate(device, [], "Alex", null, photo)).status).toBe("invalid_category");
    expect((await nominate(device, null, "Alex", null, photo)).status).toBe("invalid_category");
    expect((await nominate(device, ["funniest"], "x".repeat(61), null, photo)).status).toBe("invalid_name");
    expect((await nominate(device, ["funniest"], null, "x".repeat(61), photo)).status).toBe("invalid_name");
    expect((await nominate(device, ["funniest"], "bad\u001b[31m", null, photo)).status).toBe("invalid_name");
    expect((await nominate(device, ["funniest"], "x".repeat(60), "y".repeat(60), photo)).status).toBe("ok");
  });

  it("requires an uploaded photo under this device's prefix, used once", async () => {
    await openVoting();
    const device = newDevice();
    const nom = (photo: string) => nominate(device, ["funniest"], "Alex", null, photo);
    expect((await nom(await uploadPhoto(newDevice()))).status).toBe("invalid_photo");
    expect((await nom(`${device}/${newDevice()}.jpg`)).status).toBe("invalid_photo");
    expect((await nom("../etc/passwd")).status).toBe("invalid_photo");

    const photo = await uploadPhoto(device);
    expect((await nom(photo)).status).toBe("ok");
    expect((await nom(photo)).status).toBe("invalid_photo");
  });

  it("rate limits a device to 10 nominations per window", async () => {
    await openVoting();
    const device = newDevice();
    for (let i = 0; i < 10; i++) {
      expect((await nominate(device, ["funniest"], "Alex", null, "missing.jpg")).status).toBe("invalid_photo");
    }
    expect((await nominate(device, ["funniest"], "Alex", null, "missing.jpg")).status).toBe("rate_limited");
  });
});

describe("add_nominee_to_category", () => {
  it("adds an existing nominee to another category and logs it", async () => {
    await openVoting();
    const n = await createNominee(newDevice(), "funniest", "Sam", "The Mad Hatter");
    const guest = newDevice();
    const res = await addToCategory(guest, n, "most_unique");
    expect(res.status).toBe("ok");
    expect(await categoriesOf(n)).toEqual(["funniest", "most_unique"]);
    expect(await vote(newDevice(), "most_unique", n)).toBe("ok");

    const [e] = await editsOf(n);
    expect(e).toMatchObject({ device_id: guest, added_categories: ["most_unique"], removed_categories: [] });
    expect((await getNominee(n)).person_name).toBe("Sam");
  });

  it("reports already_in_category, unknown, hidden, and invalid category", async () => {
    await openVoting();
    const n = await createNominee(newDevice(), "funniest");
    const guest = newDevice();
    expect((await addToCategory(guest, n, "funniest")).status).toBe("already_in_category");
    expect((await addToCategory(guest, newDevice(), "funniest")).status).toBe("not_found");
    expect((await addToCategory(guest, n, "scariest")).status).toBe("invalid_category");
    await admin.from("nominees").update({ hidden: true }).eq("id", n);
    expect((await addToCategory(guest, n, "most_unique")).status).toBe("not_found");
    expect(await countRows("nominee_edits")).toBe(0);
  });

  it("is rejected outside the voting window", async () => {
    const n = await seedNominee(["funniest"]);
    expect((await addToCategory(newDevice(), n, "most_unique")).status).toBe("closed");
    await openVoting();
    await closeVoting();
    expect((await addToCategory(newDevice(), n, "most_unique")).status).toBe("closed");
    expect(await categoriesOf(n)).toEqual(["funniest"]);
  });

  it("shares the 10-per-window edit limit, separate from nominating", async () => {
    await openVoting();
    const device = newDevice();
    const n = await createNominee(newDevice(), "funniest");
    for (let i = 0; i < 9; i++) expect((await addToCategory(device, n, "funniest")).status).toBe("already_in_category");
    expect((await edit(device, n, { person: "Sam" })).status).toBe("ok");
    expect((await addToCategory(device, n, "most_unique")).status).toBe("rate_limited");
    expect((await edit(device, n, { person: "Pat" })).status).toBe("rate_limited");
    // Nominating has its own counter.
    expect((await nominate(device, ["funniest"], "Alex", null, await uploadPhoto(device))).status).toBe("ok");
  });
});

describe("edit_nominee", () => {
  it("changes names, photo, and adds categories, recording old and new values", async () => {
    await openVoting();
    const creator = newDevice();
    const n = await createNominee(creator, "funniest", "Sam", null);
    const oldPhoto = (await getNominee(n)).photo_path;
    const editor = newDevice();
    const newPhoto = await uploadPhoto(editor);

    const res = await edit(editor, n, { person: " Sam ", costume: "The Mad Hatter", photo: newPhoto, add: ["most_elaborate"] });
    expect(res.status).toBe("ok");
    expect(await getNominee(n)).toEqual({
      person_name: "Sam",
      costume_name: "The Mad Hatter",
      photo_path: newPhoto,
      hidden: false,
    });
    expect(await categoriesOf(n)).toEqual(["funniest", "most_elaborate"]);

    const history = await editsOf(n);
    expect(history).toHaveLength(1);
    expect(history[0]).toMatchObject({
      id: res.edit_id,
      device_id: editor,
      old_person_name: "Sam",
      new_person_name: "Sam",
      old_costume_name: null,
      new_costume_name: "The Mad Hatter",
      old_photo_path: oldPhoto,
      new_photo_path: newPhoto,
      added_categories: ["most_elaborate"],
      removed_categories: [],
      undoes_edit_id: null,
    });
  });

  it("clears a name when it is blanked, and reports no_change without logging", async () => {
    await openVoting();
    const n = await createNominee(newDevice(), "funniest", "Sam", "Hatter");
    const guest = newDevice();
    expect((await edit(guest, n, { costume: "  " })).status).toBe("ok");
    expect((await getNominee(n)).costume_name).toBeNull();
    expect((await edit(guest, n, {})).status).toBe("no_change");
    expect((await edit(guest, n, { add: ["funniest"] })).status).toBe("no_change");
    expect(await editsOf(n)).toHaveLength(1);
  });

  it("is rejected before voting opens and after it closes", async () => {
    const n = await seedNominee(["funniest"], "Sam");
    const guest = newDevice();
    expect((await edit(guest, n, { person: "Pat" })).status).toBe("closed");
    await openVoting();
    await closeVoting();
    expect((await edit(guest, n, { person: "Pat" })).status).toBe("closed");
    expect((await getNominee(n)).person_name).toBe("Sam");
    expect(await editsOf(n)).toHaveLength(0);
  });

  it("validates names, categories, unknown and hidden nominees", async () => {
    await openVoting();
    const n = await createNominee(newDevice(), "funniest");
    const guest = newDevice();
    expect((await edit(guest, n, { person: "x".repeat(61) })).status).toBe("invalid_name");
    expect((await edit(guest, n, { costume: "bad\u0007" })).status).toBe("invalid_name");
    expect((await edit(guest, n, { add: ["scariest"] })).status).toBe("invalid_category");
    expect((await edit(guest, newDevice(), { person: "x", costume: null })).status).toBe("not_found");
    await admin.from("nominees").update({ hidden: true }).eq("id", n);
    expect((await edit(guest, n, { person: "Pat" })).status).toBe("not_found");
  });

  it("applies the create_nominee photo rules, and never reuses a replaced photo", async () => {
    await openVoting();
    const guest = newDevice();
    const n = await createNominee(newDevice(), "funniest");
    const other = await createNominee(newDevice(), "funniest");
    const original = (await getNominee(n)).photo_path;

    expect((await edit(guest, n, { photo: await uploadPhoto(newDevice()) })).status).toBe("invalid_photo");
    expect((await edit(guest, n, { photo: `${guest}/${newDevice()}.jpg` })).status).toBe("invalid_photo");
    expect((await edit(guest, n, { photo: (await getNominee(other)).photo_path })).status).toBe("invalid_photo");

    expect((await edit(guest, n, { photo: await uploadPhoto(guest) })).status).toBe("ok");
    // The replaced photo stays in history for undo, so no other nominee may take it.
    const thief = original.split("/")[0];
    expect((await nominate(thief, ["funniest"], "x", null, original)).status).toBe("invalid_photo");
  });

  it("only the host can edit after voting closes", async () => {
    await openVoting();
    const n = await createNominee(newDevice(), "funniest", "Sam");
    await closeVoting();
    expect((await edit(newDevice(), n, { person: "Pat" })).status).toBe("closed");

    const photo = await uploadPhoto("host");
    const res = await hostEdit(n, { person: "Pat", photo, add: ["most_unique"] });
    expect(res.status).toBe("ok");
    expect(await getNominee(n)).toMatchObject({ person_name: "Pat", photo_path: photo });
    expect(await categoriesOf(n)).toEqual(["funniest", "most_unique"]);
    expect((await editsOf(n))[0].device_id).toBeNull();

    // Host photos must be under the host prefix.
    expect((await hostEdit(n, { photo: await uploadPhoto(newDevice()) })).status).toBe("invalid_photo");
  });
});

describe("admin_set_category", () => {
  it("removing a category deletes only that category's votes for the nominee", async () => {
    await openVoting();
    const n = await createNominee(newDevice(), ["funniest", "most_unique"]);
    const other = await createNominee(newDevice(), "funniest");
    const [g1, g2] = [newDevice(), newDevice()];
    await vote(g1, "funniest", n);
    await vote(g1, "most_unique", n);
    await vote(g2, "funniest", other);

    const res = await setCategory(n, "funniest", false);
    expect(res.status).toBe("ok");
    expect(await categoriesOf(n)).toEqual(["most_unique"]);
    expect(await votesFor(n, "funniest")).toBe(0);
    expect(await votesFor(n, "most_unique")).toBe(1);
    expect(await votesFor(other, "funniest")).toBe(1);
    expect((await editsOf(n))[0]).toMatchObject({ device_id: null, removed_categories: ["funniest"] });
  });

  it("cannot remove a nominee's last category", async () => {
    await openVoting();
    const n = await createNominee(newDevice(), "funniest");
    await vote(newDevice(), "funniest", n);
    expect((await setCategory(n, "funniest", false)).status).toBe("last_category");
    expect(await categoriesOf(n)).toEqual(["funniest"]);
    expect(await votesFor(n)).toBe(1);
  });

  it("adds categories at any time, and reports no_change and bad input", async () => {
    const n = await seedNominee(["funniest"]);
    expect((await setCategory(n, "best_couples", true)).status).toBe("ok");
    expect(await categoriesOf(n)).toEqual(["best_couples", "funniest"]);
    expect((await setCategory(n, "best_couples", true)).status).toBe("no_change");
    expect((await setCategory(n, "most_unique", false)).status).toBe("no_change");
    expect((await setCategory(n, "scariest", true)).status).toBe("invalid_category");
    expect((await setCategory(newDevice(), "funniest", true)).status).toBe("not_found");
  });
});

describe("undo_nominee_edit", () => {
  it("restores the old names and photo", async () => {
    await openVoting();
    const n = await createNominee(newDevice(), "funniest", "Sam", "Hatter");
    const before = await getNominee(n);
    const guest = newDevice();
    const res = await edit(guest, n, { person: "Pat", costume: null, photo: await uploadPhoto(guest) });

    expect((await undo(res.edit_id!)).status).toBe("ok");
    expect(await getNominee(n)).toEqual(before);
  });

  it("restores only the fields that edit changed, even if later edits changed them again", async () => {
    await openVoting();
    const n = await createNominee(newDevice(), "funniest", "Sam", "Hatter");
    const guest = newDevice();
    const first = await edit(guest, n, { person: "Pat" });
    await edit(guest, n, { person: "Jo", costume: "Queen of Hearts" });

    expect((await undo(first.edit_id!)).status).toBe("ok");
    expect(await getNominee(n)).toMatchObject({ person_name: "Sam", costume_name: "Queen of Hearts" });
  });

  it("is logged as a host edit and can itself be undone", async () => {
    await openVoting();
    const n = await createNominee(newDevice(), "funniest", "Sam");
    const res = await edit(newDevice(), n, { person: "Pat" });
    const u = await undo(res.edit_id!);

    const history = await editsOf(n);
    expect(history).toHaveLength(2);
    expect(history[1]).toMatchObject({
      id: u.edit_id,
      device_id: null,
      old_person_name: "Pat",
      new_person_name: "Sam",
      undoes_edit_id: res.edit_id,
    });

    expect((await undo(u.edit_id!)).status).toBe("ok");
    expect((await getNominee(n)).person_name).toBe("Pat");
  });

  it("undoing a category add removes the category and its votes", async () => {
    await openVoting();
    const n = await createNominee(newDevice(), "funniest");
    const res = await addToCategory(newDevice(), n, "most_unique");
    await vote(newDevice(), "most_unique", n);
    await vote(newDevice(), "funniest", n);

    expect((await undo(res.edit_id!)).status).toBe("ok");
    expect(await categoriesOf(n)).toEqual(["funniest"]);
    expect(await votesFor(n, "most_unique")).toBe(0);
    expect(await votesFor(n, "funniest")).toBe(1);
  });

  it("undoing a category removal re-adds the category", async () => {
    const n = await seedNominee(["funniest", "most_unique"]);
    const res = await setCategory(n, "most_unique", false);
    expect((await undo(res.edit_id!)).status).toBe("ok");
    expect(await categoriesOf(n)).toEqual(["funniest", "most_unique"]);
  });

  it("works after voting closes, and refuses to remove the last category", async () => {
    await openVoting();
    const n = await createNominee(newDevice(), "funniest");
    const added = await addToCategory(newDevice(), n, "most_unique");
    await setCategory(n, "funniest", false);
    await closeVoting();

    expect((await undo(added.edit_id!)).status).toBe("last_category");
    expect(await categoriesOf(n)).toEqual(["most_unique"]);
    expect((await undo(999999999)).status).toBe("not_found");
  });
});

describe("set_timer", () => {
  it("start opens voting for the chosen duration", async () => {
    const res = await rpc<TimerResult>("set_timer", { p_action: "start", p_minutes: 30 });
    expect(res.status).toBe("ok");
    expect(minutesFromNow(res.voting_closes_at!)).toBeGreaterThan(29);
    expect(minutesFromNow(res.voting_closes_at!)).toBeLessThan(31);
    expect(await rpc<boolean>("voting_is_open")).toBe(true);
  });

  it("extend and end before start report not_started", async () => {
    expect((await rpc<TimerResult>("set_timer", { p_action: "extend", p_minutes: 5 })).status).toBe(
      "not_started",
    );
    expect((await rpc<TimerResult>("set_timer", { p_action: "end" })).status).toBe("not_started");
  });

  it("extend while open adds to the current close time", async () => {
    await openVoting(30);
    const res = await rpc<TimerResult>("set_timer", { p_action: "extend", p_minutes: 10 });
    expect(minutesFromNow(res.voting_closes_at!)).toBeGreaterThan(39);
    expect(minutesFromNow(res.voting_closes_at!)).toBeLessThan(41);
  });

  it("extend after closing reopens immediately for now + N", async () => {
    await openVoting(30);
    await closeVoting();
    expect(await rpc<boolean>("voting_is_open")).toBe(false);
    const res = await rpc<TimerResult>("set_timer", { p_action: "extend", p_minutes: 5 });
    expect(minutesFromNow(res.voting_closes_at!)).toBeGreaterThan(4);
    expect(minutesFromNow(res.voting_closes_at!)).toBeLessThan(6);
    expect(await rpc<boolean>("voting_is_open")).toBe(true);
  });

  it("start after closing reopens with a fresh duration", async () => {
    await openVoting(30);
    await closeVoting();
    const res = await rpc<TimerResult>("set_timer", { p_action: "start", p_minutes: 15 });
    expect(minutesFromNow(res.voting_closes_at!)).toBeGreaterThan(14);
    expect(minutesFromNow(res.voting_closes_at!)).toBeLessThan(16);
    expect(await rpc<boolean>("voting_is_open")).toBe(true);
  });

  it("rejects bad actions and durations without changing settings", async () => {
    const before = await getSettings();
    expect((await rpc<TimerResult>("set_timer", { p_action: "start", p_minutes: 0 })).status).toBe("invalid");
    expect((await rpc<TimerResult>("set_timer", { p_action: "start" })).status).toBe("invalid");
    expect((await rpc<TimerResult>("set_timer", { p_action: "pause" })).status).toBe("invalid");
    expect(await getSettings()).toEqual(before);
  });
});

describe("merge_nominees", () => {
  it("unions categories, moves votes, keeps totals, and deletes the duplicate", async () => {
    await openVoting();
    const keep = await createNominee(newDevice(), ["funniest"], "Sam", "Mad Hatter");
    const drop = await createNominee(newDevice(), ["funniest", "most_elaborate"], "Sam", "mad hatter");
    const [g1, g2, g3] = [newDevice(), newDevice(), newDevice()];
    await vote(g1, "funniest", keep);
    await vote(g2, "funniest", drop);
    await vote(g3, "funniest", drop);
    // g1 voted for keep in one category and drop in another: both votes survive.
    await vote(g1, "most_elaborate", drop);

    expect((await merge(keep, drop)).status).toBe("ok");
    expect(await categoriesOf(keep)).toEqual(["funniest", "most_elaborate"]);
    expect(await votesFor(keep, "funniest")).toBe(3);
    expect(await votesFor(keep, "most_elaborate")).toBe(1);
    expect(await getNominee(keep)).toMatchObject({ person_name: "Sam", costume_name: "Mad Hatter" });

    const { count } = await admin.from("nominees").select("*", { count: "exact", head: true }).eq("id", drop);
    expect(count).toBe(0);

    // Every device still has exactly one vote per category.
    const { data } = await admin.from("votes").select("device_id, category");
    const keys = data!.map((r) => `${r.device_id}:${r.category}`);
    expect(new Set(keys).size).toBe(keys.length);
    expect(keys).toHaveLength(4);
  });

  it("rejects merging with itself or unknown ids", async () => {
    await openVoting();
    const a = await createNominee(newDevice(), "funniest");
    expect((await merge(a, a)).status).toBe("same_nominee");
    expect((await merge(a, newDevice())).status).toBe("not_found");
    expect((await merge(newDevice(), a)).status).toBe("not_found");
  });
});

describe("reset_all", () => {
  it("clears all tables and the timer, and returns current and replaced photo paths", async () => {
    await openVoting();
    const n = await createNominee(newDevice(), "funniest");
    await vote(newDevice(), "funniest", n);
    const guest = newDevice();
    await edit(guest, n, { photo: await uploadPhoto(guest) });

    const paths = await rpc<string[]>("reset_all");
    expect(paths).toHaveLength(2);
    await admin.storage.from("nominee-photos").remove(paths);

    for (const table of ["votes", "nominee_edits", "nominee_categories", "nominees", "rate_limits"]) {
      expect(await countRows(table), table).toBe(0);
    }
    expect(await getSettings()).toEqual({ voting_opens_at: null, voting_closes_at: null });
  });
});
