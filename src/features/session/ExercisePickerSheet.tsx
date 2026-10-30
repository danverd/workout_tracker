"use client";

import { useMemo } from "react";
import { availableExercises, findExercise, substitutesFor } from "./catalog";
import type { Catalog } from "./catalog";
import { ExercisePicker } from "./ExercisePicker";

/** What the picker is open for: swapping the item with `id`, or adding. */
export type Picking = { kind: "swap"; id: string } | { kind: "add" } | null;

export interface ExercisePickerSheetProps {
  picking: Picking;
  catalog: Catalog;
  locationId: string | null;
  /** Exercise being replaced when swapping; null for a blank line. */
  currentExerciseId: string | null;
  /** Extra suggestions ranked ahead of the generic substitutes. */
  extraCandidateIds?: readonly string[];
  onPick: (exerciseId: string) => void;
  onClose: () => void;
}

const NO_IDS: readonly string[] = [];

export function ExercisePickerSheet({
  picking,
  catalog,
  locationId,
  currentExerciseId,
  extraCandidateIds = NO_IDS,
  onPick,
  onClose,
}: ExercisePickerSheetProps) {
  const swapping = picking?.kind === "swap";
  const available = useMemo(
    () => new Set(availableExercises(catalog, locationId).map((e) => e.id)),
    [catalog, locationId],
  );
  const candidateIds = useMemo(
    () =>
      swapping
        ? [
            ...new Set([
              ...extraCandidateIds,
              ...substitutesFor(
                catalog,
                locationId,
                findExercise(catalog, currentExerciseId),
              ),
            ]),
          ]
        : [],
    [swapping, extraCandidateIds, catalog, locationId, currentExerciseId],
  );

  return (
    <ExercisePicker
      open={picking !== null}
      title={swapping ? "Swap exercise" : "Add exercise"}
      onClose={onClose}
      onPick={onPick}
      exercises={catalog.exercises}
      availableIds={available}
      candidateIds={candidateIds}
      currentId={swapping ? currentExerciseId : null}
    />
  );
}
