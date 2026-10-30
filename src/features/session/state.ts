import type { Mutation } from "@/lib/save-queue/types";
import type { SessionSetInput } from "@/lib/validation/sessions";
import type {
  SessionDto,
  SessionExerciseDto,
  SessionSetDto,
} from "@/types/domain";

/** What the logger edits: a session without its cardio entry. */
export type LoggerSession = Omit<SessionDto, "cardio">;

const byPosition = <T extends { position: number }>(a: T, b: T) =>
  a.position - b.position;

export function toSetInput(set: SessionSetDto): SessionSetInput {
  return {
    id: set.id,
    position: set.position,
    weight: set.weight,
    reps: set.reps,
    done: set.done,
  };
}

/**
 * Applies a mutation to local state. Used for optimistic updates and to replay
 * queued work on top of server state after a reload. Pure and idempotent.
 */
export function applyMutation(
  session: LoggerSession,
  mutation: Mutation,
): LoggerSession {
  if (mutation.sessionId !== session.id) return session;
  switch (mutation.type) {
    case "putSet":
      return {
        ...session,
        exercises: session.exercises.map((exercise) => {
          if (exercise.id !== mutation.exerciseId) return exercise;
          const existing = exercise.sets.find((s) => s.id === mutation.set.id);
          const next: SessionSetDto = {
            ...mutation.set,
            sessionExerciseId: exercise.id,
            volume: existing?.volume ?? 0,
          };
          return {
            ...exercise,
            sets: (existing
              ? exercise.sets.map((s) => (s.id === next.id ? next : s))
              : [...exercise.sets, next]
            ).sort(byPosition),
          };
        }),
      };
    case "deleteSet":
      return {
        ...session,
        exercises: session.exercises.map((exercise) =>
          exercise.id === mutation.exerciseId
            ? {
                ...exercise,
                sets: exercise.sets.filter((s) => s.id !== mutation.setId),
              }
            : exercise,
        ),
      };
    case "putExercise": {
      const { exercise: input, snapshot } = mutation;
      const existing = session.exercises.find((e) => e.id === input.id);
      const next: SessionExerciseDto = {
        id: input.id,
        sessionId: session.id,
        exerciseId: existing?.exerciseId ?? input.exerciseId,
        slotId: input.slotId,
        position: input.position,
        name: existing?.name ?? snapshot?.name ?? "Exercise",
        loadType: existing?.loadType ?? snapshot?.loadType ?? "total",
        baseWeight: existing?.baseWeight ?? snapshot?.baseWeight ?? 0,
        sets: existing?.sets ?? [],
      };
      return {
        ...session,
        exercises: (existing
          ? session.exercises.map((e) => (e.id === next.id ? next : e))
          : [...session.exercises, next]
        ).sort(byPosition),
      };
    }
    case "deleteExercise":
      return {
        ...session,
        exercises: session.exercises.filter(
          (e) => e.id !== mutation.exerciseId,
        ),
      };
    case "patchSession":
      return { ...session, ...mutation.patch };
    case "finish":
      return { ...session, finishedAt: mutation.finishedAt };
    case "reopen":
      return { ...session, finishedAt: null };
    case "putCardio":
      // Cardio is saved from its own form; there is no logger state to update.
      return session;
  }
}

export interface DoneDefaults {
  /** Reps from the matching set last time. */
  lastReps: number | null;
  /** Target reps from the program slot (rep_min / fixed). */
  targetReps: number | null;
  /** Reps of the previous set in this exercise today. */
  previousReps: number | null;
}

/**
 * Toggles a set's done flag. Marking done with no reps yet fills them with
 * last time's reps, else the target reps (design §6.4), else the previous
 * set's reps. Un-doing keeps whatever reps are there.
 */
export function toggleDone(
  set: SessionSetDto,
  defaults: DoneDefaults,
): SessionSetInput {
  const input = toSetInput(set);
  if (set.done) return { ...input, done: false };
  return {
    ...input,
    done: true,
    reps:
      set.reps ??
      defaults.lastReps ??
      defaults.targetReps ??
      defaults.previousReps,
  };
}
