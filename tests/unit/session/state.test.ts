import { describe, expect, it } from "vitest";
import {
  applyMutation,
  toggleDone,
  type LoggerSession,
} from "@/features/session/state";
import type { Mutation } from "@/lib/save-queue/types";

const U = (n: number) =>
  `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const S = U(1);

const base: LoggerSession = {
  id: S,
  date: "2026-10-30",
  kind: "strength",
  locationId: null,
  programId: null,
  programDayId: null,
  title: "",
  dayName: "",
  bodyweightLb: 180,
  notes: "",
  startedAt: "2026-10-30T10:00:00.000Z",
  finishedAt: null,
  exercises: [],
};

const addExercise: Mutation = {
  type: "putExercise",
  sessionId: S,
  exercise: { id: U(2), exerciseId: U(3), slotId: null, position: 0 },
  snapshot: { name: "Press", loadType: "per_hand", baseWeight: 0 },
};
const addSet = (n: number, weight = 50): Mutation => ({
  type: "putSet",
  sessionId: S,
  exerciseId: U(2),
  set: { id: U(10 + n), position: n, weight, reps: null, done: false },
});

describe("applyMutation", () => {
  it("replays a queue onto server state, idempotently", () => {
    const queued: Mutation[] = [
      addExercise,
      addSet(1),
      addSet(0),
      addSet(0, 55),
    ];
    const once = queued.reduce(applyMutation, base);
    const twice = queued.reduce(applyMutation, once);
    expect(twice).toEqual(once);
    expect(once.exercises[0].name).toBe("Press");
    expect(once.exercises[0].sets.map((s) => [s.position, s.weight])).toEqual([
      [0, 55],
      [1, 50],
    ]);
  });

  it("keeps the snapshot when an exercise is upserted again", () => {
    const moved: Mutation = {
      ...addExercise,
      exercise: { id: U(2), exerciseId: U(99), slotId: null, position: 4 },
      snapshot: { name: "Other", loadType: "total", baseWeight: 5 },
    };
    const state = [addExercise, addSet(0), moved].reduce(applyMutation, base);
    expect(state.exercises[0]).toMatchObject({
      name: "Press",
      exerciseId: U(3),
      position: 4,
    });
    expect(state.exercises[0].sets).toHaveLength(1);
  });

  it("deletes sets and exercises, patches and finishes", () => {
    let state = [addExercise, addSet(0), addSet(1)].reduce(applyMutation, base);
    state = applyMutation(state, {
      type: "deleteSet",
      sessionId: S,
      exerciseId: U(2),
      setId: U(10),
    });
    expect(state.exercises[0].sets).toHaveLength(1);
    state = applyMutation(state, {
      type: "patchSession",
      sessionId: S,
      patch: { locationId: U(5) },
    });
    expect(state.locationId).toBe(U(5));
    state = applyMutation(state, {
      type: "finish",
      sessionId: S,
      finishedAt: "2026-10-30T11:00:00.000Z",
    });
    expect(state.finishedAt).toBe("2026-10-30T11:00:00.000Z");
    state = applyMutation(state, { type: "reopen", sessionId: S });
    expect(state.finishedAt).toBeNull();
    state = applyMutation(state, {
      type: "deleteExercise",
      sessionId: S,
      exerciseId: U(2),
    });
    expect(state.exercises).toEqual([]);
  });

  it("ignores mutations for another session", () => {
    expect(applyMutation(base, { type: "reopen", sessionId: U(77) })).toBe(
      base,
    );
  });
});

describe("toggleDone", () => {
  const set = {
    id: U(1),
    sessionExerciseId: U(2),
    position: 1,
    weight: 40,
    reps: null,
    done: false,
    volume: 0,
  };
  it("prefers last reps, then target, then previous set", () => {
    const d = { lastReps: 9, targetReps: 8, previousReps: 7 };
    expect(toggleDone(set, d).reps).toBe(9);
    expect(toggleDone(set, { ...d, lastReps: null }).reps).toBe(8);
    expect(
      toggleDone(set, { ...d, lastReps: null, targetReps: null }).reps,
    ).toBe(7);
    expect(
      toggleDone(set, { lastReps: null, targetReps: null, previousReps: null })
        .reps,
    ).toBeNull();
  });
  it("keeps typed reps and toggles back off", () => {
    const typed = { ...set, reps: 12 };
    const d = { lastReps: 9, targetReps: 8, previousReps: 7 };
    expect(toggleDone(typed, d)).toMatchObject({ reps: 12, done: true });
    expect(toggleDone({ ...typed, done: true }, d)).toMatchObject({
      reps: 12,
      done: false,
    });
  });
});
