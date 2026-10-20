"use client";
import { Photo } from "@/components/Photo";
import { SECONDARY } from "@/components/ui";
import type { NomineeEdit } from "@/lib/adminApi";
import { describeEdit, undoneIds } from "@/lib/editHistory";

// Edit log for one nominee, newest first, with an undo per entry. Undoing asks first, and warns
// when it would remove a category (which deletes that category's votes).
export function EditHistory({
  edits,
  disabled,
  onUndo,
}: {
  edits: NomineeEdit[];
  disabled: boolean;
  onUndo: (editId: number) => void;
}) {
  const undone = undoneIds(edits);
  if (edits.length === 0) return <p className="text-lg text-violet-200">No edits yet.</p>;
  return (
    <ul className="space-y-3">
      {edits.map((e) => {
        const d = describeEdit(e);
        const when = new Date(e.createdAt).toLocaleString([], { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
        const isUndone = undone.has(e.id);
        // Undoing an edit that added categories removes them again.
        const dropsVotes = e.addedCategories.length > 0;
        return (
          <li key={e.id} className="space-y-2 rounded-2xl bg-white/5 px-4 py-3 ring-1 ring-white/10">
            <p className="font-semibold">
              {d.who} · {when}
              {isUndone && <span className="ml-2 rounded bg-zinc-700 px-2 py-0.5 text-sm font-normal">Undone</span>}
            </p>
            {e.undoesEditId !== null && <p className="text-violet-200">Undo of edit #{e.undoesEditId}</p>}
            {d.names.map((n) => (
              <p key={n.field}>
                {n.field}: <span className="text-violet-200">{n.from}</span> → {n.to}
              </p>
            ))}
            {d.photoChanged && (
              <div className="flex items-center gap-3">
                <div className="w-16">
                  <Photo photoUrl={e.oldPhotoUrl} alt="Photo before" />
                </div>
                <span aria-hidden>→</span>
                <div className="w-16">
                  <Photo photoUrl={e.newPhotoUrl} alt="Photo after" />
                </div>
              </div>
            )}
            {d.added.map((c) => (
              <p key={`+${c}`}>+ {c}</p>
            ))}
            {d.removed.map((c) => (
              <p key={`-${c}`}>− {c}</p>
            ))}
            {!isUndone && (
              <button
                type="button"
                disabled={disabled}
                onClick={() => {
                  const warn = dropsVotes ? " This removes the category and its votes." : "";
                  if (window.confirm(`Undo this edit?${warn}`)) onUndo(e.id);
                }}
                className={`${SECONDARY} w-full`}
              >
                Undo this edit
              </button>
            )}
          </li>
        );
      })}
    </ul>
  );
}
