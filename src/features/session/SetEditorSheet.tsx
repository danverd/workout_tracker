"use client";

import { BottomSheet } from "@/ui/BottomSheet";
import { Button } from "@/ui/Button";
import { ChipGroup } from "@/ui/ChipGroup";
import { Stepper } from "@/ui/Stepper";
import { findExercise, weightListFor, type Catalog } from "./catalog";
import type { LoggerSession } from "./state";

export type Editing = {
  exerciseRowId: string;
  setId: string;
  field: "weight" | "reps";
} | null;

export function SetEditorSheet({
  editing,
  session,
  catalog,
  onChangeField,
  onEdit,
  onRemoveSet,
  onClose,
}: {
  editing: Editing;
  session: LoggerSession;
  catalog: Catalog;
  onChangeField: (field: "weight" | "reps") => void;
  onEdit: (
    rowId: string,
    setId: string,
    change: { weight?: number; reps?: number | null },
  ) => void;
  onRemoveSet: (rowId: string, setId: string) => void;
  onClose: () => void;
}) {
  const row = editing
    ? session.exercises.find((e) => e.id === editing.exerciseRowId)
    : undefined;
  const set = row?.sets.find((s) => s.id === editing?.setId);
  const exercise = findExercise(catalog, row?.exerciseId ?? null);

  return (
    <BottomSheet
      open={editing !== null && Boolean(set)}
      onClose={onClose}
      title={
        row && set
          ? `${row.name}, set ${row.sets.indexOf(set) + 1}`
          : "Edit set"
      }
    >
      {editing && row && set ? (
        <div className="flex flex-col gap-5">
          <ChipGroup
            label="Edit"
            options={[
              { value: "weight", label: "Weight" },
              { value: "reps", label: "Reps" },
            ]}
            value={[editing.field]}
            onChange={([field]) =>
              field && onChangeField(field as "weight" | "reps")
            }
          />
          {editing.field === "weight" ? (
            <Stepper
              label="Weight"
              unit="lb"
              value={set.weight}
              increment={exercise?.increment ?? 5}
              options={
                weightListFor(catalog, session.locationId, exercise) ??
                undefined
              }
              onChange={(weight) => onEdit(row.id, set.id, { weight })}
            />
          ) : (
            <Stepper
              label="Reps"
              value={set.reps}
              increment={1}
              onChange={(reps) => onEdit(row.id, set.id, { reps })}
            />
          )}
          <div className="flex items-center justify-between">
            <Button
              variant="destructive"
              onClick={() => {
                onRemoveSet(row.id, set.id);
                onClose();
              }}
            >
              Remove set
            </Button>
            <Button variant="secondary" onClick={onClose}>
              Done
            </Button>
          </div>
        </div>
      ) : null}
    </BottomSheet>
  );
}
