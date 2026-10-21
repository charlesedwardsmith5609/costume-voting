import { MYSTERY_LABEL } from "./nomineeLabel";

/** Label shown on the slideshow management grid: real names as returned; mystery and unused as "No name". */
export function slideshowDisplayLabel(label: string | null): string {
  if (!label || label === MYSTERY_LABEL) return "No name";
  return label;
}
