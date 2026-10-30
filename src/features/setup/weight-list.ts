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

export function fromWeights(weights: number[] | null): WeightListState {
  return weights && weights.length > 0
    ? { mode: "list", pool: [...weights].sort((a, b) => a - b), off: [] }
    : { mode: "list", pool: [], off: [] };
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
