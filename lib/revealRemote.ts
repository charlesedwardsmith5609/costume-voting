// Phone remote for the winner reveal: the commands the phone sends, the status the TV page
// publishes, and the label of the phone's main button. Shared by the browser and the routes.
export const REVEAL_COMMANDS = ["reveal", "next", "previous", "start_slideshow", "exit_slideshow", "mute_toggle"] as const;
export type RevealCommand = (typeof REVEAL_COMMANDS)[number];

export function isRevealCommand(v: unknown): v is RevealCommand {
  return REVEAL_COMMANDS.some((c) => c === v);
}

export const REVEAL_STEPS = ["start", "category", "winners", "slideshow"] as const;

// What the TV page is showing right now.
export type RevealState = {
  step: (typeof REVEAL_STEPS)[number];
  index: number; // category index (the number of categories on the winners page)
  count: number; // number of categories
  label: string | null; // current category
  revealed: boolean;
  rolling: boolean; // drumroll in progress
  muted: boolean;
  winners: string[]; // single-line names of the current category's winners (for the host only)
};

// The TV page is considered gone when its status is older than this.
export const TV_STALE_MS = 12_000;

export type MainAction = { label: string; command: RevealCommand | null };

// The big button on the phone: what the next tap does (command null = nothing to send yet).
export function mainAction(s: RevealState): MainAction {
  if (s.step === "start") return { label: "Tap “Tap to start” on the TV", command: null };
  if (s.step === "slideshow") return { label: "Stop slideshow", command: "exit_slideshow" };
  if (s.step === "winners") return { label: "Start slideshow", command: "start_slideshow" };
  if (s.rolling) return { label: "Drumroll…", command: null };
  if (!s.revealed) return { label: "Reveal winner", command: "reveal" };
  return s.index >= s.count - 1 ? { label: "Show all winners", command: "next" } : { label: "Next category", command: "next" };
}

export function canGoBack(s: RevealState): boolean {
  return (s.step === "category" || s.step === "winners") && s.index > 0 && !s.rolling;
}
