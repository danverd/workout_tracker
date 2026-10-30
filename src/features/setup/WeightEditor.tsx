"use client";

import { useState } from "react";

import {
  applyRange,
  inferRange,
  toggleWeight,
  type WeightListState,
} from "@/features/setup/weight-list";
import { Button } from "@/ui/Button";
import { Chip } from "@/ui/Chip";
import { NumberField } from "@/ui/NumberField";

/** Min / max / step range builder plus per-weight chips for one equipment. */
export function WeightEditor({
  equipmentName,
  state,
  onChange,
}: {
  equipmentName: string;
  state: WeightListState;
  onChange: (state: WeightListState) => void;
}) {
  const [inferred] = useState(() => inferRange(state.pool));
  const [min, setMin] = useState<number | null>(inferred?.min ?? 5);
  const [max, setMax] = useState<number | null>(inferred?.max ?? 50);
  const [step, setStep] = useState<number | null>(inferred?.step ?? 5);
  const none = state.mode === "none";
  const rangeOk =
    min !== null && max !== null && step !== null && step > 0 && max >= min;

  return (
    <section
      aria-label={`${equipmentName} weights`}
      className="border-hairline flex flex-col gap-3 border-t pt-4"
    >
      <div className="flex items-center justify-between gap-3">
        <h3 className="font-display text-title text-steel font-semibold">
          {equipmentName}
        </h3>
        <Chip
          selected={none}
          onClick={() =>
            onChange(
              none ? { ...state, mode: "list" } : { ...state, mode: "none" },
            )
          }
        >
          No weight list
        </Chip>
      </div>

      {none ? (
        <p className="text-meta text-rubber">
          Any weight works here. The stepper will use the exercise&apos;s
          increment.
        </p>
      ) : (
        <>
          <div className="grid grid-cols-3 gap-2">
            <NumberField label="Min" value={min} onChange={setMin} />
            <NumberField label="Max" value={max} onChange={setMax} />
            <NumberField label="Step" value={step} onChange={setStep} />
          </div>
          <Button
            disabled={!rangeOk}
            onClick={() =>
              onChange(applyRange({ min: min!, max: max!, step: step! }))
            }
          >
            {state.pool.length > 0 ? "Replace weights" : "Create weights"}
          </Button>
          {state.pool.length > 0 ? (
            <>
              <div
                role="group"
                aria-label={`Available ${equipmentName} weights`}
                className="flex flex-wrap gap-2"
              >
                {state.pool.map((weight) => (
                  <Chip
                    key={weight}
                    selected={!state.off.includes(weight)}
                    onClick={() => onChange(toggleWeight(state, weight))}
                  >
                    {weight}
                  </Chip>
                ))}
              </div>
              <p className="text-meta text-rubber">
                Tap a weight to turn it off if this place doesn&apos;t have it.
              </p>
            </>
          ) : (
            <p className="text-meta text-rubber">
              Set a range, like 5 to 80 by 5, to list what&apos;s available.
            </p>
          )}
        </>
      )}
    </section>
  );
}
