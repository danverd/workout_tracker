import type { EffectiveWeightRule } from "@/types/workout";

export type VolumeMode = EffectiveWeightRule;

export function effectiveWeight(mode: VolumeMode, entered: number): number {
  switch (mode) {
    case "leg_press":
      return 136 + 2 * entered;
    case "super_squats":
      return 75 + 2 * entered;
    case "barbell":
      return 45 + 2 * entered;
    case "dumbbell":
    case "cable_per_hand":
    case "cable_per_arm":
      return 2 * entered;
    case "assisted":
      return Math.max(0, 245 - entered);
    case "bodyweight":
      return 0;
    default:
      return entered;
  }
}

export function setVolume(
  mode: VolumeMode,
  entered: number,
  reps: number,
): number {
  return effectiveWeight(mode, entered) * reps;
}
