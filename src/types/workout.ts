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

export type EffectiveWeightRule =
  | "stack"
  | "leg_press"
  | "super_squats"
  | "barbell"
  | "dumbbell"
  | "assisted"
  | "cable_per_hand"
  | "cable_per_arm"
  | "bodyweight"
  | "kettlebell";

export interface TemplateSetDefinition {
  position: number;
  target: SetTarget;
  baselineInputWeight: number;
}

export interface ExerciseDefinition {
  slug: string;
  name: string;
  inputMode: ExerciseInputMode;
  effectiveWeightRule: EffectiveWeightRule;
  defaultSets: TemplateSetDefinition[];
}

export interface TemplateDefinition {
  slug: string;
  name: string;
  kind: "lifting" | "cardio";
  exerciseSlugs: string[];
}

export interface WorkoutSetInput {
  position: number;
  target: SetTarget;
  actualReps: number | null;
  inputWeight: number;
}

export interface WorkoutExerciseInput {
  position: number;
  exerciseSlug: string;
  name: string;
  inputMode: ExerciseInputMode;
  effectiveWeightRule: EffectiveWeightRule;
  sets: WorkoutSetInput[];
}

export type CardioKind = "treadmill" | "rowing" | "stairmaster";
export interface CardioActivityInput {
  position: number;
  kind: CardioKind;
  incline: number | null;
  speed: number | null;
  duration: string | null;
  pace: string | null;
}

export interface WorkoutPayload {
  date: string;
  templateSlug: string;
  templateName: string;
  status: WorkoutStatus;
  exercises: WorkoutExerciseInput[];
  cardioActivities: CardioActivityInput[];
}
