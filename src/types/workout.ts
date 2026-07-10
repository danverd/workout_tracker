export type WorkoutStatus = "in_progress" | "finished";

export type SetTarget = { kind: "reps"; reps: number } | { kind: "amrap" };

export type ExerciseInputMode =
  | "stack"
  | "one_side_plates"
  | "per_dumbbell"
  | "per_hand"
  | "per_arm"
  | "machine_assistance"
  | "bodyweight"
  | "kettlebell";

export type WorkoutTemplateKind = "lifting" | "cardio";

export interface TemplateSetDefinition {
  position: number;
  target: SetTarget;
  baselineInputWeight: number;
}

export interface ExerciseDefinition {
  slug: string;
  name: string;
  inputMode: ExerciseInputMode;
}
