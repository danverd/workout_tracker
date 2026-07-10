import { and, asc, desc, eq, gte, inArray, lt, lte, sql } from "drizzle-orm";
import { database } from "./client";
import {
  cardioActivities,
  workoutExercises,
  workoutInstances,
  workoutSets,
} from "./schema";
import type { WorkoutPayload } from "@/types/workout";
import { effectiveWeight } from "@/lib/volume";
import { exerciseBySlug } from "@/lib/templates";

type DatabaseTransaction = Parameters<
  Parameters<ReturnType<typeof database>["transaction"]>[0]
>[0];

export class WorkoutNotFoundError extends Error {
  constructor() {
    super("Workout not found.");
  }
}

export async function getWorkout(date: string): Promise<WorkoutPayload | null> {
  const db = database();
  const [workout] = await db
    .select()
    .from(workoutInstances)
    .where(eq(workoutInstances.workoutDate, date));
  if (!workout) return null;
  const rows = await db
    .select({ exercise: workoutExercises, set: workoutSets })
    .from(workoutExercises)
    .leftJoin(
      workoutSets,
      eq(workoutSets.workoutExerciseId, workoutExercises.id),
    )
    .where(eq(workoutExercises.workoutId, workout.id))
    .orderBy(asc(workoutExercises.position), asc(workoutSets.position));
  const cardio = await db
    .select()
    .from(cardioActivities)
    .where(eq(cardioActivities.workoutId, workout.id))
    .orderBy(asc(cardioActivities.position));
  const grouped = new Map<string, WorkoutPayload["exercises"][number]>();
  for (const row of rows) {
    const e = row.exercise;
    if (!grouped.has(e.id))
      grouped.set(e.id, {
        position: e.position,
        exerciseSlug: e.exerciseSlug,
        name: e.name,
        inputMode:
          e.inputMode as WorkoutPayload["exercises"][number]["inputMode"],
        effectiveWeightRule:
          e.effectiveWeightRule as WorkoutPayload["exercises"][number]["effectiveWeightRule"],
        sets: [],
      });
    if (row.set)
      grouped.get(e.id)!.sets.push({
        position: row.set.position,
        target:
          row.set.targetKind === "amrap"
            ? { kind: "amrap" }
            : { kind: "reps", reps: row.set.targetReps! },
        actualReps: row.set.actualReps,
        inputWeight: row.set.inputWeight,
      });
  }
  return {
    date: workout.workoutDate,
    templateSlug: workout.templateSlug,
    templateName: workout.templateName,
    status: workout.status,
    exercises: [...grouped.values()],
    cardioActivities: cardio.map((item) => ({
      position: item.position,
      kind: item.kind as WorkoutPayload["cardioActivities"][number]["kind"],
      incline: item.incline,
      speed: item.speed,
      duration: item.duration,
      pace: item.pace,
    })),
  };
}
export async function historyForExerciseSlugs(
  date: string,
  slugs: string[],
): Promise<Record<string, number[]>> {
  if (!slugs.length) return {};
  const db = database();
  const rows = await db
    .select({
      slug: workoutExercises.exerciseSlug,
      date: workoutInstances.workoutDate,
      weight: workoutSets.inputWeight,
    })
    .from(workoutExercises)
    .innerJoin(
      workoutInstances,
      eq(workoutExercises.workoutId, workoutInstances.id),
    )
    .innerJoin(
      workoutSets,
      eq(workoutSets.workoutExerciseId, workoutExercises.id),
    )
    .where(
      and(
        inArray(workoutExercises.exerciseSlug, slugs),
        lt(workoutInstances.workoutDate, date),
      ),
    )
    .orderBy(desc(workoutInstances.workoutDate), asc(workoutSets.position));
  const result: Record<string, number[]> = {};
  const selectedDate: Record<string, string> = {};
  for (const row of rows) {
    if (!selectedDate[row.slug]) selectedDate[row.slug] = row.date;
    if (selectedDate[row.slug] === row.date)
      (result[row.slug] ??= []).push(row.weight);
  }
  return result;
}
export async function saveWorkout(
  payload: WorkoutPayload,
  create?: { templateId: string | null },
): Promise<WorkoutPayload> {
  const db = database();
  await db.transaction(async (tx) => {
    const [workout] = create
      ? await tx
          .insert(workoutInstances)
          .values({
            workoutDate: payload.date,
            templateId: create.templateId,
            templateSlug: payload.templateSlug,
            templateName: payload.templateName,
          })
          .returning()
      : await tx
          .select()
          .from(workoutInstances)
          .where(eq(workoutInstances.workoutDate, payload.date));
    if (!workout) throw new WorkoutNotFoundError();
    await replaceWorkoutContents(tx, workout.id, payload);
    await tx
      .update(workoutInstances)
      .set({ updatedAt: new Date() })
      .where(eq(workoutInstances.id, workout.id));
  });
  return (await getWorkout(payload.date))!;
}

async function replaceWorkoutContents(
  tx: DatabaseTransaction,
  workoutId: string,
  payload: WorkoutPayload,
) {
  await tx
    .delete(cardioActivities)
    .where(eq(cardioActivities.workoutId, workoutId));
  await tx
    .delete(workoutExercises)
    .where(eq(workoutExercises.workoutId, workoutId));
  for (const exercise of payload.exercises) {
    const definition = exerciseBySlug.get(exercise.exerciseSlug);
    if (!definition) throw new Error("Unknown exercise.");
    const [created] = await tx
      .insert(workoutExercises)
      .values({
        workoutId,
        exerciseSlug: exercise.exerciseSlug,
        name: definition.name,
        inputMode: definition.inputMode,
        effectiveWeightRule: definition.effectiveWeightRule,
        position: exercise.position,
      })
      .returning();
    await tx.insert(workoutSets).values(
      exercise.sets.map((set) => ({
        workoutExerciseId: created.id,
        position: set.position,
        targetKind: set.target.kind,
        targetReps: set.target.kind === "reps" ? set.target.reps : null,
        actualReps: set.actualReps,
        inputWeight: set.inputWeight,
        effectiveWeight:
          definition.slug === "back-extensions" && set.position % 2 === 1
            ? 0
            : effectiveWeight(definition.effectiveWeightRule, set.inputWeight),
      })),
    );
  }
  if (payload.cardioActivities.length)
    await tx
      .insert(cardioActivities)
      .values(payload.cardioActivities.map((item) => ({ ...item, workoutId })));
}
export async function getSummary(start: string, end: string) {
  const db = database();
  const rows = await db
    .select({
      date: workoutInstances.workoutDate,
      templateName: workoutInstances.templateName,
      status: workoutInstances.status,
      volume: sql<number>`coalesce(sum(${workoutSets.effectiveWeight} * ${workoutSets.actualReps}), 0)`,
    })
    .from(workoutInstances)
    .leftJoin(
      workoutExercises,
      eq(workoutExercises.workoutId, workoutInstances.id),
    )
    .leftJoin(
      workoutSets,
      eq(workoutSets.workoutExerciseId, workoutExercises.id),
    )
    .where(
      and(
        gte(workoutInstances.workoutDate, start),
        lte(workoutInstances.workoutDate, end),
        eq(workoutInstances.status, "finished"),
      ),
    )
    .groupBy(workoutInstances.id)
    .orderBy(asc(workoutInstances.workoutDate));
  return {
    workouts: rows,
    totalVolume: rows.reduce((sum, row) => sum + Number(row.volume), 0),
  };
}
