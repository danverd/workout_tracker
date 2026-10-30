"use client";

import { ChipGroup } from "@/ui/ChipGroup";
import { MinusIcon, PlusIcon } from "@/ui/icons";
import { NumberField } from "@/ui/NumberField";

export type StepperProps = {
  /** What is being edited, e.g. "Weight" or "Reps". Used in button names. */
  label: string;
  /** Current value; null when not set yet. */
  value: number | null;
  onChange: (value: number) => void;
  /** Amount each - / + press changes the value by. */
  increment: number;
  /** Quick-pick values, e.g. the location's available dumbbells. */
  options?: readonly number[];
  /** Lowest allowed value. Defaults to 0. */
  min?: number;
  /** Optional unit shown next to the value and in the keypad field. */
  unit?: string;
};

function round(n: number): number {
  return Math.round(n * 1000) / 1000;
}

export function Stepper({
  label,
  value,
  onChange,
  increment,
  options,
  min = 0,
  unit,
}: StepperProps) {
  const current = value ?? min;

  function step(direction: 1 | -1) {
    onChange(Math.max(min, round(current + direction * increment)));
  }

  return (
    <div className="flex flex-col gap-5">
      <div className="flex items-center justify-between gap-3">
        <button
          type="button"
          aria-label={`Decrease ${label.toLowerCase()}`}
          onClick={() => step(-1)}
          disabled={current <= min}
          className="border-steel text-steel enabled:active:bg-sunken inline-flex size-16 shrink-0 items-center justify-center border select-none disabled:opacity-35"
        >
          <MinusIcon size={28} />
        </button>
        <div
          role="status"
          aria-label={`${label} ${value ?? "not set"}${unit ? ` ${unit}` : ""}`}
          className="flex min-w-0 items-baseline justify-center gap-1.5"
        >
          <span
            aria-hidden="true"
            className="font-display text-numeral text-steel font-bold tabular-nums"
          >
            {value ?? "—"}
          </span>
          {unit ? (
            <span aria-hidden="true" className="text-lead text-rubber">
              {unit}
            </span>
          ) : null}
        </div>
        <button
          type="button"
          aria-label={`Increase ${label.toLowerCase()}`}
          onClick={() => step(1)}
          className="border-steel text-steel enabled:active:bg-sunken inline-flex size-16 shrink-0 items-center justify-center border select-none"
        >
          <PlusIcon size={28} />
        </button>
      </div>

      {options && options.length > 0 ? (
        <ChipGroup
          label={`${label} quick picks`}
          options={options.map((option) => ({ value: String(option) }))}
          value={value === null ? [] : [String(value)]}
          onChange={([picked]) => {
            if (picked !== undefined) onChange(Math.max(min, Number(picked)));
          }}
        />
      ) : null}

      <NumberField
        label={`Type ${label.toLowerCase()}`}
        value={value}
        unit={unit}
        onChange={(next) => {
          if (next !== null) onChange(Math.max(min, next));
        }}
      />
    </div>
  );
}
