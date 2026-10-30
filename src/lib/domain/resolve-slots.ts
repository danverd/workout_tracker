import type { SetTarget, UsageHistory } from "@/types/domain";

export interface SlotInput extends SetTarget {
  id: string;
  movementId: string | null;
  exerciseId: string | null;
}

export interface ResolvableExercise {
  id: string;
  name: string;
  movementId: string | null;
  equipmentIds: readonly string[];
  archived: boolean;
}

export type SlotStatus =
  /** An exercise was picked automatically. */
  | "resolved"
  /** A specific-exercise slot whose equipment is missing here. */
  | "unavailable"
  /** A movement slot with no usable exercise: the owner must choose. */
  | "choose";

export interface ResolvedSlot {
  slotId: string;
  status: SlotStatus;
  /** The picked exercise; null for "unavailable" and "choose". */
  exerciseId: string | null;
  /** Ranked exercises available here for this slot (substitutes/choices). */
  candidateIds: string[];
  /** Every exercise available at the location, alphabetical. */
  availableIds: string[];
}

/** All required equipment is present (no equipment = available anywhere). */
export function isAvailableAt(
  exercise: ResolvableExercise,
  locationEquipmentIds: ReadonlySet<string>,
) {
  return (
    !exercise.archived &&
    exercise.equipmentIds.every((id) => locationEquipmentIds.has(id))
  );
}

/** Most recently used at this location, then anywhere, then alphabetical. */
export function rankCandidates(
  candidates: readonly ResolvableExercise[],
  usage: UsageHistory,
): ResolvableExercise[] {
  const tier = (exercise: ResolvableExercise) =>
    usage.lastUsedAtLocation[exercise.id]
      ? 0
      : usage.lastUsedAnywhere[exercise.id]
        ? 1
        : 2;
  const lastUsed = (exercise: ResolvableExercise) =>
    tier(exercise) === 0
      ? usage.lastUsedAtLocation[exercise.id]
      : (usage.lastUsedAnywhere[exercise.id] ?? "");
  return [...candidates].sort((a, b) => {
    const byTier = tier(a) - tier(b);
    if (byTier !== 0) return byTier;
    if (tier(a) < 2) {
      const recent = lastUsed(b).localeCompare(lastUsed(a));
      if (recent !== 0) return recent;
    }
    return a.name.localeCompare(b.name);
  });
}

/** Resolves each slot of a day for a location (design §6.3). */
export function resolveSlots(input: {
  slots: readonly SlotInput[];
  exercises: readonly ResolvableExercise[];
  locationEquipmentIds: Iterable<string>;
  usage: UsageHistory;
}): ResolvedSlot[] {
  const here = new Set(input.locationEquipmentIds);
  const available = input.exercises.filter((exercise) =>
    isAvailableAt(exercise, here),
  );
  const availableIds = [...available]
    .sort((a, b) => a.name.localeCompare(b.name))
    .map((exercise) => exercise.id);
  const byId = new Map(
    input.exercises.map((exercise) => [exercise.id, exercise]),
  );

  return input.slots.map((slot): ResolvedSlot => {
    const base = { slotId: slot.id, availableIds };
    if (slot.exerciseId) {
      const wanted = byId.get(slot.exerciseId);
      if (wanted && isAvailableAt(wanted, here))
        return {
          ...base,
          status: "resolved",
          exerciseId: wanted.id,
          candidateIds: [wanted.id],
        };
      const movementId = wanted?.movementId ?? null;
      const substitutes = movementId
        ? rankCandidates(
            available.filter((exercise) => exercise.movementId === movementId),
            input.usage,
          )
        : [];
      return {
        ...base,
        status: "unavailable",
        exerciseId: null,
        candidateIds: substitutes.map((exercise) => exercise.id),
      };
    }
    const ranked = rankCandidates(
      available.filter((exercise) => exercise.movementId === slot.movementId),
      input.usage,
    );
    return {
      ...base,
      status: ranked.length > 0 ? "resolved" : "choose",
      exerciseId: ranked[0]?.id ?? null,
      candidateIds: ranked.map((exercise) => exercise.id),
    };
  });
}
