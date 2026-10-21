import { describe, expect, it } from "vitest";
import { canGoBack, isRevealCommand, mainAction, type RevealState } from "@/lib/revealRemote";
import { parseRevealState } from "@/lib/server/revealRemote";

const state = (over: Partial<RevealState> = {}): RevealState => ({
  step: "category",
  index: 0,
  count: 4,
  label: "Funniest",
  revealed: false,
  rolling: false,
  muted: false,
  winners: ["Sam"],
  ...over,
});

describe("mainAction", () => {
  it("walks reveal, next, show all winners, slideshow", () => {
    expect(mainAction(state())).toEqual({ label: "Reveal winner", command: "reveal" });
    expect(mainAction(state({ rolling: true })).command).toBeNull();
    expect(mainAction(state({ revealed: true }))).toEqual({ label: "Next category", command: "next" });
    expect(mainAction(state({ index: 3, revealed: true }))).toEqual({ label: "Show all winners", command: "next" });
    expect(mainAction(state({ step: "winners", index: 4 }))).toEqual({ label: "Start slideshow", command: "start_slideshow" });
    expect(mainAction(state({ step: "slideshow", index: 4 }))).toEqual({ label: "Stop slideshow", command: "exit_slideshow" });
  });

  it("sends nothing before the TV page has started", () => {
    expect(mainAction(state({ step: "start" })).command).toBeNull();
  });
});

describe("canGoBack", () => {
  it("is false on the first category, during a drumroll, and in the slideshow", () => {
    expect(canGoBack(state())).toBe(false);
    expect(canGoBack(state({ index: 2 }))).toBe(true);
    expect(canGoBack(state({ index: 2, rolling: true }))).toBe(false);
    expect(canGoBack(state({ step: "slideshow", index: 4 }))).toBe(false);
    expect(canGoBack(state({ step: "winners", index: 4 }))).toBe(true);
  });
});

describe("isRevealCommand and parseRevealState", () => {
  it("accepts only known commands", () => {
    expect(isRevealCommand("reveal")).toBe(true);
    expect(isRevealCommand("reset")).toBe(false);
    expect(isRevealCommand(undefined)).toBe(false);
  });

  it("accepts a well-formed state and rejects bad shapes and sizes", () => {
    expect(parseRevealState(state())).toEqual(state());
    expect(parseRevealState(null)).toBeNull();
    expect(parseRevealState({ ...state(), step: "other" })).toBeNull();
    expect(parseRevealState({ ...state(), index: -1 })).toBeNull();
    expect(parseRevealState({ ...state(), winners: Array(11).fill("x") })).toBeNull();
    expect(parseRevealState({ ...state(), label: "x".repeat(81) })).toBeNull();
    expect(parseRevealState({ ...state(), extra: "dropped" })).toEqual(state());
  });
});
