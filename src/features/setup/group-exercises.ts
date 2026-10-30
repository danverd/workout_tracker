import type { ExerciseDto, MovementDto } from "@/types/domain";

export interface ExerciseGroup<E extends ExerciseDto> {
  /** Movement id, or null for exercises without one. */
  movementId: string | null;
  title: string;
  exercises: E[];
}

/** Active exercises grouped by movement (alphabetical, "No movement" last). */
export function groupByMovement<E extends ExerciseDto>(
  exercises: readonly E[],
  movements: readonly MovementDto[],
): ExerciseGroup<E>[] {
  const groups: ExerciseGroup<E>[] = [];
  for (const movement of [...movements].sort((a, b) =>
    a.name.localeCompare(b.name),
  )) {
    const inGroup = exercises.filter((e) => e.movementId === movement.id);
    if (inGroup.length > 0)
      groups.push({
        movementId: movement.id,
        title: movement.name,
        exercises: inGroup,
      });
  }
  const known = new Set(movements.map((m) => m.id));
  const loose = exercises.filter(
    (e) => !e.movementId || !known.has(e.movementId),
  );
  if (loose.length > 0)
    groups.push({ movementId: null, title: "No movement", exercises: loose });
  return groups;
}
