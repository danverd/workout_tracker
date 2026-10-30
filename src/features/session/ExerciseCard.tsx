"use client";

import { memo } from "react";
import { buttonClass } from "@/ui/button-styles";
import { SetRow } from "@/ui/SetRow";
import type { SessionExerciseDto, SetTarget } from "@/types/domain";
import {
  findExercise,
  formatLast,
  formatTarget,
  lastRepsAt,
  targetReps,
  type Catalog,
} from "./catalog";
import { needsWeight } from "./useSessionLogger";

export interface ExerciseCardProps {
  row: SessionExerciseDto;
  catalog: Catalog;
  target: SetTarget | null;
  onToggleDone: (rowId: string, setId: string) => void;
  onEditWeight: (rowId: string, setId: string) => void;
  onEditReps: (rowId: string, setId: string) => void;
  onAddSet: (rowId: string) => void;
  onSwap: (rowId: string) => void;
  onRemove: (rowId: string) => void;
}

export const ExerciseCard = memo(function ExerciseCard({
  row,
  catalog,
  target,
  onToggleDone,
  onEditWeight,
  onEditReps,
  onAddSet,
  onSwap,
  onRemove,
}: ExerciseCardProps) {
  const exercise = findExercise(catalog, row.exerciseId);
  const lastSets = row.exerciseId
    ? catalog.lastSets[row.exerciseId]
    : undefined;
  const meta = [formatTarget(target, row.sets.length), formatLast(lastSets)]
    .filter(Boolean)
    .join("   ");

  return (
    <section
      aria-label={row.name}
      className="border-hairline mb-3 border-b pb-1"
    >
      <h2 className="text-lead text-steel font-semibold">{row.name}</h2>
      <p className="text-meta text-rubber pb-1">{meta}</p>
      <div className="border-hairline border-t">
        {row.sets.map((set, index) => (
          <SetRow
            key={set.id}
            rowId={row.id}
            setId={set.id}
            index={index + 1}
            weight={
              needsWeight(row.loadType, set.weight, lastSets)
                ? null
                : set.weight
            }
            reps={set.reps}
            repsHint={
              lastRepsAt(lastSets, index) ?? targetReps(target) ?? undefined
            }
            done={set.done}
            onToggleDone={onToggleDone}
            onEditWeight={onEditWeight}
            onEditReps={onEditReps}
          />
        ))}
      </div>
      <div className="flex items-center gap-1">
        <button
          type="button"
          onClick={() => onAddSet(row.id)}
          className={buttonClass("quiet")}
        >
          + Add set
        </button>
        <span className="flex-1" />
        <button
          type="button"
          onClick={() => onSwap(row.id)}
          className={buttonClass("quiet")}
        >
          Swap
        </button>
        <button
          type="button"
          onClick={() => onRemove(row.id)}
          className="text-body text-rubber min-h-12 pl-3 font-medium"
        >
          Remove
        </button>
      </div>
      {exercise ? null : (
        <p className="text-meta text-rubber">
          This exercise was archived or deleted.
        </p>
      )}
    </section>
  );
});
