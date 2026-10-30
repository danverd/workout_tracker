import { expandRange, type WeightRange } from "@/lib/domain/weights";

/** Editing state for one equipment item's weight list at a location. */
export interface WeightListState {
  /** "none" saves null: no weight list ("any"). */
  mode: "list" | "none";
  /** Every weight shown as a chip, ascending. */
  pool: number[];
  /** Pool weights toggled off (for example no 55s at home). */
  off: number[];
}

export const emptyWeightList: WeightListState = {
  mode: "list",
  pool: [],
  off: [],
};

/** Min, max and the most common gap (smallest on a tie) of a weight list. */
export function inferRange(weights: readonly number[]): WeightRange | null {
  const sorted = [...new Set(weights)].sort((a, b) => a - b);
  if (sorted.length === 0) return null;
  const counts = new Map<number, number>();
  for (let i = 1; i < sorted.length; i++) {
    const gap = Math.round((sorted[i] - sorted[i - 1]) * 1000) / 1000;
    counts.set(gap, (counts.get(gap) ?? 0) + 1);
  }
  let step = 0;
  let best = 0;
  for (const [gap, count] of counts) {
    if (count > best || (count === best && gap < step)) {
      step = gap;
      best = count;
    }
  }
  return {
    min: sorted[0],
    max: sorted[sorted.length - 1],
    step: step > 0 ? step : 5,
  };
}

const MAX_POOL = 300;

/**
 * Saved weights back into editing state. Gaps in the saved list (a missing 55)
 * come back as toggled-off chips so they can be re-enabled.
 */
export function fromWeights(weights: number[] | null): WeightListState {
  if (!weights || weights.length === 0) return emptyWeightList;
  const saved = [...new Set(weights)].sort((a, b) => a - b);
  const range = inferRange(saved);
  const full = range ? expandRange(range) : saved;
  const pool =
    full.length <= MAX_POOL && saved.every((w) => full.includes(w))
      ? full
      : saved;
  return {
    mode: "list",
    pool,
    off: pool.filter((w) => !saved.includes(w)),
  };
}

/** A fresh list from min / max / step; replaces the pool and clears toggles. */
export function applyRange(range: WeightRange): WeightListState {
  return { mode: "list", pool: expandRange(range), off: [] };
}

export function toggleWeight(
  state: WeightListState,
  weight: number,
): WeightListState {
  return {
    ...state,
    off: state.off.includes(weight)
      ? state.off.filter((w) => w !== weight)
      : [...state.off, weight],
  };
}

/** The weights to save: null when there is no list or every chip is off. */
export function toWeights(state: WeightListState): number[] | null {
  if (state.mode === "none") return null;
  const on = state.pool.filter((w) => !state.off.includes(w));
  return on.length > 0 ? on : null;
}
