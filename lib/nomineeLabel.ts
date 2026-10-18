// Display labels for nominees (SPEC "Nominee labels"). Names arrive trimmed, or null when blank.
type Names = { personName: string | null; costumeName: string | null };

export const MYSTERY_LABEL = "Mystery guest 👻";

// Card form: person name on top, costume name below. A photo-only nominee is a mystery guest.
export function labelLines(n: Names): { top: string; bottom: string | null; mystery: boolean } {
  if (n.personName && n.costumeName) return { top: n.personName, bottom: n.costumeName, mystery: false };
  if (n.personName) return { top: n.personName, bottom: null, mystery: false };
  if (n.costumeName) return { top: n.costumeName, bottom: null, mystery: false };
  return { top: MYSTERY_LABEL, bottom: null, mystery: true };
}

// Single-line form for results, CSV, and the winner reveal: "Sam as The Mad Hatter".
export function singleLine(n: Names): string {
  const { top, bottom } = labelLines(n);
  return bottom ? `${top} as ${bottom}` : top;
}
