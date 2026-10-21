import { INPUT } from "./ui";

// The two optional names, each at most 60 characters (SPEC "Add a nominee").
export function NameFields({
  personName,
  costumeName,
  disabled,
  onChange,
}: {
  personName: string;
  costumeName: string;
  disabled: boolean;
  onChange: (field: "personName" | "costumeName", value: string) => void;
}) {
  return (
    <div className="space-y-3">
      <label className="block space-y-1">
        <span className="text-lg font-semibold">Who is it?</span>
        <input
          className={INPUT}
          value={personName}
          maxLength={60}
          placeholder="Sam"
          autoComplete="off"
          disabled={disabled}
          onChange={(e) => onChange("personName", e.target.value)}
        />
      </label>
      <label className="block space-y-1">
        <span className="text-lg font-semibold">What are they?</span>
        <input
          className={INPUT}
          value={costumeName}
          maxLength={60}
          placeholder="The Mad Hatter"
          autoComplete="off"
          disabled={disabled}
          onChange={(e) => onChange("costumeName", e.target.value)}
        />
      </label>
    </div>
  );
}

// Trimmed, or null when blank, as the API stores it.
export const cleanName = (value: string): string | null => value.trim() || null;
