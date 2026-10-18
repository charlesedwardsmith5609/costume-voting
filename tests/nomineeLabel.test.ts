import { describe, expect, it } from "vitest";
import { labelLines, MYSTERY_LABEL, singleLine } from "@/lib/nomineeLabel";

describe("nominee labels", () => {
  it("both names: two lines on cards, 'X as Y' on one line", () => {
    const n = { personName: "Sam", costumeName: "The Mad Hatter" };
    expect(labelLines(n)).toEqual({ top: "Sam", bottom: "The Mad Hatter", mystery: false });
    expect(singleLine(n)).toBe("Sam as The Mad Hatter");
  });

  it("person only", () => {
    const n = { personName: "Sam", costumeName: null };
    expect(labelLines(n)).toEqual({ top: "Sam", bottom: null, mystery: false });
    expect(singleLine(n)).toBe("Sam");
  });

  it("costume only", () => {
    const n = { personName: null, costumeName: "The Mad Hatter" };
    expect(labelLines(n)).toEqual({ top: "The Mad Hatter", bottom: null, mystery: false });
    expect(singleLine(n)).toBe("The Mad Hatter");
  });

  it("photo only is a mystery guest", () => {
    const n = { personName: null, costumeName: null };
    expect(labelLines(n)).toEqual({ top: MYSTERY_LABEL, bottom: null, mystery: true });
    expect(singleLine(n)).toBe("Mystery guest 👻");
  });
});
