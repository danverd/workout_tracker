import { exerciseBySlug, templateBySlug } from "@/lib/templates";
import type { WorkoutExerciseInput, WorkoutPayload } from "@/types/workout";

export function mapHistoricalWeights(
  baselines: number[],
  history: number[],
): number[] {
  if (!history.length) return baselines.map((weight) => weight ?? 0);
  return baselines.map(
    (weight, index) => history[index] ?? history.at(-1) ?? weight ?? 0,
  );
}

export function makeWorkoutFromTemplate(
  date: string,
  templateSlug: string,
  history: Record<string, number[]> = {},
): WorkoutPayload {
  const template = templateBySlug.get(templateSlug);
  if (!template) throw new Error("Unknown template.");
  const exercises: WorkoutExerciseInput[] = template.exerciseSlugs.map(
    (slug, index) => {
      const exercise = exerciseBySlug.get(slug)!;
      const weights = mapHistoricalWeights(
        exercise.defaultSets.map((set) => set.baselineInputWeight),
        history[slug] ?? [],
      );
      return {
        position: index + 1,
        exerciseSlug: slug,
        name: exercise.name,
        inputMode: exercise.inputMode,
        effectiveWeightRule: exercise.effectiveWeightRule,
        sets: exercise.defaultSets.map((set, setIndex) => ({
          ...set,
          inputWeight: weights[setIndex],
          actualReps: set.target.kind === "reps" ? set.target.reps : null,
        })),
      };
    },
  );
  return {
    date,
    templateSlug,
    templateName: template.name,
    status: "in_progress",
    exercises,
    cardioActivities: [],
  };
}

export function makeExerciseFromCatalog(
  exerciseSlug: string,
  position: number,
  historicalWeights: number[] = [],
): WorkoutExerciseInput {
  const exercise = exerciseBySlug.get(exerciseSlug);
  if (!exercise) throw new Error("Unknown exercise.");
  const weights = mapHistoricalWeights(
    exercise.defaultSets.map((set) => set.baselineInputWeight),
    historicalWeights,
  );
  return {
    position,
    exerciseSlug,
    name: exercise.name,
    inputMode: exercise.inputMode,
    effectiveWeightRule: exercise.effectiveWeightRule,
    sets: exercise.defaultSets.map((set, index) => ({
      ...set,
      inputWeight: weights[index],
      actualReps: set.target.kind === "reps" ? set.target.reps : null,
    })),
  };
}
