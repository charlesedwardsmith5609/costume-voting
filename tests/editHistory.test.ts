import { describe, expect, it } from "vitest";
import type { NomineeEdit } from "@/lib/adminApi";
import { describeEdit, editor, undoneIds } from "@/lib/editHistory";

const base: NomineeEdit = {
  id: 1,
  deviceId: null,
  oldPersonName: "Sam",
  newPersonName: "Sam",
  oldCostumeName: null,
  newCostumeName: null,
  oldPhotoUrl: "https://cdn/a.jpg",
  newPhotoUrl: "https://cdn/a.jpg",
  addedCategories: [],
  removedCategories: [],
  undoesEditId: null,
  createdAt: "2026-10-24T20:00:00Z",
};

describe("editor", () => {
  it("names the host, or a guest by the last 4 characters of the device ID", () => {
    expect(editor(null)).toBe("Host");
    expect(editor("11111111-2222-4333-8444-55555555a1b2")).toBe("Guest ·a1b2");
  });
});

describe("describeEdit", () => {
  it("lists changed names with (blank) for an empty one", () => {
    const d = describeEdit({ ...base, newPersonName: null, oldCostumeName: null, newCostumeName: "Hatter" });
    expect(d.names).toEqual([
      { field: "Name", from: "Sam", to: "(blank)" },
      { field: "Costume", from: "(blank)", to: "Hatter" },
    ]);
  });

  it("flags a photo change and labels category changes", () => {
    const d = describeEdit({ ...base, newPhotoUrl: "https://cdn/b.jpg", addedCategories: ["funniest"], removedCategories: ["most_unique"] });
    expect(d.names).toEqual([]);
    expect(d.photoChanged).toBe(true);
    expect(d.added).toEqual(["Funniest"]);
    expect(d.removed).toEqual(["Most Unique"]);
  });
});

describe("undoneIds", () => {
  it("collects the edits that an undo entry reversed", () => {
    expect(undoneIds([{ ...base, id: 3, undoesEditId: 2 }, { ...base, id: 2 }, { ...base, id: 1 }])).toEqual(new Set([2]));
  });
});
