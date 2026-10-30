"use client";

import { CheckIcon } from "@/ui/icons";

export type SetRowProps = {
  /** 1-based set number shown at the left. */
  index: number;
  /** Weight in the exercise's unit; null when not set. */
  weight: number | null;
  /** Reps; null when not set. */
  reps: number | null;
  /** Shown faded in place of reps when reps is null (the target). */
  repsHint?: number;
  /** Unit used in accessible names, e.g. "lb". Default "lb". */
  unit?: string;
  done: boolean;
  onToggleDone: () => void;
  /** Tapping the weight numeral. */
  onEditWeight: () => void;
  /** Tapping the reps numeral. */
  onEditReps: () => void;
};

export function SetRow({
  index,
  weight,
  reps,
  repsHint,
  unit = "lb",
  done,
  onToggleDone,
  onEditWeight,
  onEditReps,
}: SetRowProps) {
  const weightText = weight === null ? "—" : String(weight);
  const repsText = reps === null ? (repsHint ?? "—") : reps;
  const repsIsHint = reps === null && repsHint !== undefined;

  return (
    <div
      role="group"
      aria-label={`Set ${index}`}
      className="border-hairline relative flex min-h-16 items-stretch overflow-hidden border-b"
    >
      {/* Done state: tint wipes in, then the plate-blue bar rides the left edge.
          Static on first render; transitions only run when `done` flips. */}
      <span
        aria-hidden="true"
        className={`bg-plate-blue-wash absolute inset-0 origin-left transition-transform duration-200 ease-out motion-reduce:transition-none ${
          done ? "scale-x-100" : "scale-x-0"
        }`}
      />
      <span
        aria-hidden="true"
        className={`bg-plate-blue absolute inset-y-0 left-0 w-2 transition-transform duration-200 ease-out motion-reduce:transition-none ${
          done ? "translate-x-0" : "-translate-x-full"
        }`}
      />

      <span
        aria-hidden="true"
        className="font-display text-lead text-rubber relative flex w-12 shrink-0 items-center justify-center pl-2 font-semibold tabular-nums"
      >
        {index}
      </span>

      <button
        type="button"
        onClick={onEditWeight}
        aria-label={`Set ${index} weight, ${
          weight === null ? "not set" : `${weight} ${unit}`
        }. Edit`}
        className="font-display text-numeral text-steel relative flex min-w-20 flex-1 items-center justify-end gap-1 px-2 font-bold tabular-nums"
      >
        {weightText}
      </button>

      <span
        aria-hidden="true"
        className="font-display text-title text-rubber relative flex items-center font-semibold"
      >
        ×
      </span>

      <button
        type="button"
        onClick={onEditReps}
        aria-label={`Set ${index} reps, ${
          reps === null ? "not set" : reps
        }. Edit`}
        className={`font-display text-numeral relative flex min-w-16 flex-1 items-center justify-start px-2 font-bold tabular-nums ${
          repsIsHint ? "text-rubber/70" : "text-steel"
        }`}
      >
        {repsText}
      </button>

      <button
        type="button"
        aria-pressed={done}
        aria-label={`Set ${index} done`}
        onClick={onToggleDone}
        className="relative flex w-16 shrink-0 items-center justify-center"
      >
        <span
          className={`flex size-10 items-center justify-center border-2 transition-colors motion-reduce:transition-none ${
            done
              ? "border-plate-blue bg-plate-blue text-white"
              : "border-rubber bg-transparent text-transparent"
          }`}
        >
          <CheckIcon size={24} strokeWidth={3} />
        </span>
      </button>
    </div>
  );
}
