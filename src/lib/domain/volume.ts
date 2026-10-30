import { round2 } from "@/lib/format";
import type { LoadType } from "@/types/domain";

export interface LoadInput {
  loadType: LoadType;
  /** The weight as entered by the owner. */
  weight: number;
  /** Bar / sled weight (per_side only). */
  baseWeight: number;
  bodyweightLb: number;
}

/** Weight actually moved for one rep, derived from the entered weight. */
export function effectiveWeight({
  loadType,
  weight,
  baseWeight,
  bodyweightLb,
}: LoadInput): number {
  switch (loadType) {
    case "total":
      return weight;
    case "per_hand":
      return weight * 2;
    case "per_side":
      return baseWeight + weight * 2;
    case "assisted":
      return Math.max(0, bodyweightLb - weight);
    case "bodyweight":
      return bodyweightLb + weight;
  }
}

export interface SetVolumeInput extends LoadInput {
  reps: number | null;
  done: boolean;
}

/** Volume of one set. Only done sets with reps count. */
export function setVolume(input: SetVolumeInput): number {
  if (!input.done || !input.reps || input.reps < 0) return 0;
  return round2(effectiveWeight(input) * input.reps);
}
