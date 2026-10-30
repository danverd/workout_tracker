"use client";

import { useId, useState } from "react";

export type NumberFieldProps = {
  label: string;
  /** Current value; null renders empty. */
  value: number | null;
  /** Called with a parsed number, or null when the field is cleared. */
  onChange: (value: number | null) => void;
  /** Suffix shown inside the field, e.g. "lb". */
  unit?: string;
  hint?: string;
  disabled?: boolean;
  placeholder?: string;
};

const NUMBER_PATTERN = /^\d*\.?\d*$/;

export function NumberField({
  label,
  value,
  onChange,
  unit,
  hint,
  disabled,
  placeholder,
}: NumberFieldProps) {
  const id = useId();
  // While typing we keep the raw text ("12.") so partial input is not clobbered.
  const [draft, setDraft] = useState<string | null>(null);
  const shown = draft ?? (value === null ? "" : String(value));

  function handleChange(text: string) {
    if (!NUMBER_PATTERN.test(text)) return;
    setDraft(text);
    if (text === "" || text === ".") {
      onChange(null);
      return;
    }
    onChange(Number(text));
  }

  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-body text-steel font-medium">
        {label}
      </label>
      <div className="relative">
        <input
          id={id}
          type="text"
          inputMode="decimal"
          autoComplete="off"
          value={shown}
          disabled={disabled}
          placeholder={placeholder}
          aria-describedby={hint ? `${id}-hint` : undefined}
          onChange={(event) => handleChange(event.target.value)}
          onBlur={() => setDraft(null)}
          className={`rounded-field border-rubber bg-paper font-display text-title text-steel placeholder:text-rubber min-h-12 w-full border px-3 font-semibold tabular-nums disabled:opacity-45 ${
            unit ? "pr-12" : ""
          }`}
        />
        {unit ? (
          <span className="text-body text-rubber pointer-events-none absolute inset-y-0 right-3 flex items-center">
            {unit}
          </span>
        ) : null}
      </div>
      {hint ? (
        <p id={`${id}-hint`} className="text-meta text-rubber">
          {hint}
        </p>
      ) : null}
    </div>
  );
}
