"use client";

import { BottomSheet } from "@/ui/BottomSheet";
import { Button } from "@/ui/Button";
import type { SessionExerciseDto } from "@/types/domain";

export function RemoveExerciseSheet({
  row,
  onClose,
  onRemove,
}: {
  /** The exercise to remove; the sheet is open while this is set. */
  row: SessionExerciseDto | undefined;
  onClose: () => void;
  onRemove: (rowId: string) => void;
}) {
  return (
    <BottomSheet
      open={row !== undefined}
      onClose={onClose}
      title="Remove exercise"
    >
      <div className="flex flex-col gap-4">
        <p className="text-body text-steel">
          Remove {row?.name} and its {row?.sets.length ?? 0} sets from this
          session?
        </p>
        <div className="flex items-center justify-between">
          <Button variant="secondary" onClick={onClose}>
            Keep
          </Button>
          <Button
            variant="destructive"
            onClick={() => {
              if (row) onRemove(row.id);
              onClose();
            }}
          >
            Remove exercise
          </Button>
        </div>
      </div>
    </BottomSheet>
  );
}
