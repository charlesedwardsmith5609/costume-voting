// Display facts for one entry of a nominee's edit history (host view). Pure, so it is unit tested.
import { categoryLabel, type CategorySlug } from "./categories";

// One entry of a nominee's edit log. deviceId is null for host edits; undoesEditId is set on the
// entry an undo wrote.
export type NomineeEdit = {
  id: number;
  deviceId: string | null;
  oldPersonName: string | null;
  newPersonName: string | null;
  oldCostumeName: string | null;
  newCostumeName: string | null;
  oldPhotoUrl: string;
  newPhotoUrl: string;
  addedCategories: CategorySlug[];
  removedCategories: CategorySlug[];
  undoesEditId: number | null;
  createdAt: string;
};

export type EditDescription = {
  who: string;
  names: { field: string; from: string; to: string }[];
  photoChanged: boolean;
  added: string[];
  removed: string[];
};

const shown = (name: string | null) => name ?? "(blank)";

// "Host", or "Guest ·a1b2" with the last 4 characters of the device ID.
export function editor(deviceId: string | null): string {
  return deviceId === null ? "Host" : `Guest ·${deviceId.slice(-4)}`;
}

export function describeEdit(e: NomineeEdit): EditDescription {
  const names: EditDescription["names"] = [];
  if (e.oldPersonName !== e.newPersonName) {
    names.push({ field: "Name", from: shown(e.oldPersonName), to: shown(e.newPersonName) });
  }
  if (e.oldCostumeName !== e.newCostumeName) {
    names.push({ field: "Costume", from: shown(e.oldCostumeName), to: shown(e.newCostumeName) });
  }
  return {
    who: editor(e.deviceId),
    names,
    photoChanged: e.oldPhotoUrl !== e.newPhotoUrl,
    added: e.addedCategories.map(categoryLabel),
    removed: e.removedCategories.map(categoryLabel),
  };
}

// Ids of edits that a later undo entry has reversed.
export function undoneIds(edits: NomineeEdit[]): Set<number> {
  return new Set(edits.flatMap((e) => (e.undoesEditId === null ? [] : [e.undoesEditId])));
}
