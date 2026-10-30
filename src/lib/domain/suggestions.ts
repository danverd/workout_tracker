import type { LastSetDto, SetSuggestion } from "@/types/domain";
import { snapToNearest } from "./weights";

/**
 * Pre-filled weights for a new session exercise (design §6.5, §13.5).
 * `lastSets` are the done sets from the most recent session that included the
 * exercise (any location). Extra sets repeat the last weight; with no history
 * the weight is null. Weights snap to the location's available list if given.
 */
export function suggestSets(input: {
  targetSets: number;
  lastSets: readonly LastSetDto[];
  weights?: readonly number[] | null;
}): SetSuggestion[] {
  const last = [...input.lastSets].sort((a, b) => a.position - b.position);
  const available = input.weights ?? [];
  return Array.from({ length: Math.max(0, input.targetSets) }, (_, index) => {
    const source = last[index] ?? last.at(-1);
    if (!source) return { weight: null, lastReps: null };
    return {
      weight:
        available.length > 0
          ? snapToNearest(available, source.weight)
          : source.weight,
      lastReps: source.reps,
    };
  });
}
