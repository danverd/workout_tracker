import { randomUUID } from "node:crypto";
import type { Database } from "@/db/client";
import * as s from "@/db/schema";
import { setVolume } from "@/lib/domain/volume";
import type { LoadType } from "@/types/domain";

export interface SeedSet {
  weight: number;
  reps: number | null;
  done: boolean;
}

export interface SeedExercise {
  exerciseId?: string | null;
  name?: string;
  loadType?: LoadType;
  sets: SeedSet[];
}

/** Inserts a strength session with sets (volume computed like the server). */
export async function insertStrength(
  db: Database,
  opts: {
    date: string;
    title?: string;
    startedAt?: Date;
    finishedAt?: Date | null;
    locationId?: string | null;
    exercises?: SeedExercise[];
  },
) {
  const id = randomUUID();
  await db.insert(s.sessions).values({
    id,
    date: opts.date,
    kind: "strength",
    title: opts.title ?? "Push · Home",
    locationId: opts.locationId ?? null,
    bodyweightLb: 180,
    startedAt: opts.startedAt ?? new Date(),
    finishedAt: opts.finishedAt ?? null,
  });
  for (const [index, exercise] of (opts.exercises ?? []).entries()) {
    const seId = randomUUID();
    const loadType = exercise.loadType ?? "total";
    await db.insert(s.sessionExercises).values({
      id: seId,
      sessionId: id,
      exerciseId: exercise.exerciseId ?? null,
      position: index,
      name: exercise.name ?? "Bench press",
      loadType,
      baseWeight: 0,
    });
    for (const [position, set] of exercise.sets.entries()) {
      await db.insert(s.sessionSets).values({
        id: randomUUID(),
        sessionExerciseId: seId,
        position,
        weight: set.weight,
        reps: set.reps,
        done: set.done,
        volume: setVolume({
          loadType,
          weight: set.weight,
          baseWeight: 0,
          bodyweightLb: 180,
          reps: set.reps,
          done: set.done,
        }),
      });
    }
  }
  return id;
}
