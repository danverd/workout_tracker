"use client";

import { useState } from "react";

import { Button } from "@/ui/Button";
import { ChipGroup } from "@/ui/ChipGroup";
import { NumberField } from "@/ui/NumberField";
import { Select } from "@/ui/Select";
import { Stepper } from "@/ui/Stepper";
import { TextField } from "@/ui/TextField";
import {
  repsMode,
  withRepsMode,
  type DraftSlot,
  type RepsMode,
} from "@/features/programs/draft";

export interface PickerMovement {
  id: string;
  name: string;
}
export interface PickerExercise {
  id: string;
  name: string;
  movementId: string | null;
}

export type SlotEditorProps = {
  slot: DraftSlot;
  movements: readonly PickerMovement[];
  exercises: readonly PickerExercise[];
  /** Existing slots can be removed; new ones are simply cancelled. */
  onDelete?: () => void;
  onSave: (slot: DraftSlot) => void;
  saveLabel?: string;
};

const TARGET_KINDS = [
  { value: "movement", label: "Movement" },
  { value: "exercise", label: "Specific exercise" },
];
const REPS_MODES = [
  { value: "number", label: "Fixed" },
  { value: "range", label: "Range" },
  { value: "amrap", label: "AMRAP" },
];

export function SlotEditor({
  slot: initial,
  movements,
  exercises,
  onDelete,
  onSave,
  saveLabel = "Save slot",
}: SlotEditorProps) {
  const [slot, setSlot] = useState(initial);
  const [kind, setKind] = useState<"movement" | "exercise">(
    initial.exerciseId ? "exercise" : "movement",
  );
  // Held in state: it cannot be derived while the owner is mid-edit.
  const [mode, setMode] = useState<RepsMode>(repsMode(initial));
  const movementName = new Map(movements.map((m) => [m.id, m.name]));

  const hasTarget = kind === "movement" ? !!slot.movementId : !!slot.exerciseId;
  const rangeInvalid =
    mode === "range" &&
    (slot.repMin === null || slot.repMax === null || slot.repMin > slot.repMax);
  const numberInvalid = mode === "number" && slot.repMin === null;
  const repsError = rangeInvalid
    ? "Max reps must be at least min reps."
    : undefined;

  function changeKind(next: string) {
    setKind(next as "movement" | "exercise");
    setSlot((prev) => ({ ...prev, movementId: null, exerciseId: null }));
  }

  return (
    <form
      className="flex flex-col gap-5 pb-2"
      onSubmit={(event) => {
        event.preventDefault();
        if (hasTarget && !rangeInvalid && !numberInvalid) onSave(slot);
      }}
    >
      <ChipGroup
        label="Target"
        options={TARGET_KINDS}
        value={[kind]}
        onChange={([next]) => next && changeKind(next)}
      />

      {kind === "movement" ? (
        <Select
          label="Movement"
          value={slot.movementId ?? ""}
          onChange={(e) =>
            setSlot((prev) => ({ ...prev, movementId: e.target.value || null }))
          }
          options={[
            { value: "", label: "Choose a movement" },
            ...movements.map((m) => ({ value: m.id, label: m.name })),
          ]}
        />
      ) : (
        <Select
          label="Exercise"
          value={slot.exerciseId ?? ""}
          onChange={(e) =>
            setSlot((prev) => ({ ...prev, exerciseId: e.target.value || null }))
          }
          options={[
            { value: "", label: "Choose an exercise" },
            ...exercises.map((x) => {
              const movement = x.movementId && movementName.get(x.movementId);
              return {
                value: x.id,
                label: movement ? `${x.name} · ${movement}` : x.name,
              };
            }),
          ]}
        />
      )}

      <div className="flex flex-col gap-2">
        <p className="text-body text-steel font-medium">Sets</p>
        <Stepper
          label="Sets"
          value={slot.targetSets}
          increment={1}
          min={1}
          onChange={(value) =>
            setSlot((prev) => ({ ...prev, targetSets: Math.min(30, value) }))
          }
        />
      </div>

      <ChipGroup
        label="Rep target"
        options={REPS_MODES}
        value={[mode]}
        onChange={([next]) => {
          if (!next) return;
          setMode(next as RepsMode);
          setSlot((prev) => withRepsMode(prev, next as RepsMode));
        }}
      />

      {mode === "number" ? (
        <NumberField
          label="Reps"
          value={slot.repMin}
          onChange={(value) =>
            setSlot((prev) => ({ ...prev, repMin: value, repMax: value }))
          }
        />
      ) : null}
      {mode === "range" ? (
        <div className="flex flex-col gap-1.5">
          <div className="grid grid-cols-2 gap-3">
            <NumberField
              label="Min reps"
              value={slot.repMin}
              onChange={(value) =>
                setSlot((prev) => ({ ...prev, repMin: value }))
              }
            />
            <NumberField
              label="Max reps"
              value={slot.repMax}
              onChange={(value) =>
                setSlot((prev) => ({ ...prev, repMax: value }))
              }
            />
          </div>
          {repsError ? (
            <p role="alert" className="text-meta text-bumper font-medium">
              {repsError}
            </p>
          ) : null}
        </div>
      ) : null}
      {mode === "amrap" ? (
        <p className="text-body text-rubber">
          As many reps as you can in each set.
        </p>
      ) : null}

      <TextField
        label="Notes"
        value={slot.notes}
        maxLength={500}
        placeholder="Optional, for example “pause at the bottom”"
        onChange={(e) =>
          setSlot((prev) => ({ ...prev, notes: e.target.value }))
        }
      />

      <div className="flex flex-col gap-2">
        <Button
          type="submit"
          variant="primary"
          block
          disabled={!hasTarget || rangeInvalid || numberInvalid}
        >
          {saveLabel}
        </Button>
        {onDelete ? (
          <Button variant="destructive" block onClick={onDelete}>
            Delete slot
          </Button>
        ) : null}
      </div>
    </form>
  );
}
