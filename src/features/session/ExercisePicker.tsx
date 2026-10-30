"use client";

import { useState } from "react";
import { BottomSheet } from "@/ui/BottomSheet";
import { Button } from "@/ui/Button";
import { CheckIcon } from "@/ui/icons";
import type { ExerciseDto } from "@/types/domain";

export type ExercisePickerProps = {
  open: boolean;
  title: string;
  onClose: () => void;
  onPick: (exerciseId: string) => void;
  /** Every non-archived exercise. */
  exercises: readonly ExerciseDto[];
  /** Ids usable at the location. */
  availableIds: ReadonlySet<string>;
  /** Ranked substitutes shown first; empty for a plain "add". */
  candidateIds?: readonly string[];
  currentId?: string | null;
};

type Row = { exercise: ExerciseDto; available: boolean };

/**
 * Swap/add list (design §13.3): suggested exercises first, everything else
 * available here after, then "Show all exercises" for the rest.
 */
export function ExercisePicker({
  open,
  title,
  onClose,
  onPick,
  exercises,
  availableIds,
  candidateIds = [],
  currentId = null,
}: ExercisePickerProps) {
  const [showAll, setShowAll] = useState(false);

  const byId = new Map(exercises.map((exercise) => [exercise.id, exercise]));
  const suggested = candidateIds
    .map((id) => byId.get(id))
    .filter((exercise): exercise is ExerciseDto => Boolean(exercise));
  const suggestedIds = new Set(suggested.map((exercise) => exercise.id));
  const alphabetical = [...exercises].sort((a, b) =>
    a.name.localeCompare(b.name),
  );
  const otherAvailable = alphabetical.filter(
    (exercise) =>
      availableIds.has(exercise.id) && !suggestedIds.has(exercise.id),
  );
  const unavailable = alphabetical.filter(
    (exercise) => !availableIds.has(exercise.id),
  );

  // Without suggestions there is nothing to put first: list what is here.
  const primary: Row[] = (
    suggested.length > 0 ? suggested : otherAvailable
  ).map((exercise) => ({ exercise, available: true }));
  const more: Row[] = [
    ...(suggested.length > 0 ? otherAvailable : []).map((exercise) => ({
      exercise,
      available: true,
    })),
    ...unavailable.map((exercise) => ({ exercise, available: false })),
  ];
  const rows = showAll ? [...primary, ...more] : primary;

  function close() {
    setShowAll(false);
    onClose();
  }

  return (
    <BottomSheet open={open} onClose={close} title={title}>
      {rows.length === 0 ? (
        <p className="text-body text-rubber py-4">
          No exercises are set up for this location yet.
        </p>
      ) : (
        <ul>
          {rows.map(({ exercise, available }) => (
            <li key={exercise.id}>
              <button
                type="button"
                onClick={() => {
                  onPick(exercise.id);
                  close();
                }}
                aria-current={exercise.id === currentId}
                className="border-hairline flex min-h-14 w-full items-center gap-3 border-b py-2 text-left"
              >
                <span className="flex min-w-0 flex-1 flex-col">
                  <span className="text-lead text-steel truncate font-medium">
                    {exercise.name}
                  </span>
                  {available ? null : (
                    <span className="text-meta text-rubber">
                      Needs equipment this location doesn&apos;t have
                    </span>
                  )}
                </span>
                {exercise.id === currentId ? (
                  <CheckIcon size={20} className="text-plate-blue" />
                ) : null}
              </button>
            </li>
          ))}
        </ul>
      )}
      {!showAll && more.length > 0 ? (
        <div className="pt-2">
          <Button variant="quiet" onClick={() => setShowAll(true)}>
            Show all exercises
          </Button>
        </div>
      ) : null}
    </BottomSheet>
  );
}
