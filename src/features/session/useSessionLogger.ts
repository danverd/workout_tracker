"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { SaveQueue } from "@/lib/save-queue/queue";
import type { Mutation } from "@/lib/save-queue/types";
import type { SetTarget } from "@/types/domain";
import {
  findExercise,
  lastRepsAt,
  newId,
  targetReps,
  weightListFor,
  type Catalog,
} from "./catalog";
import {
  applyMutation,
  toggleDone,
  toSetInput,
  type LoggerSession,
} from "./state";
import { suggestionsFor } from "./preview";

export const DEFAULT_NEW_SETS = 3;

/**
 * A weight of 0 with no history is "never set" for anything but bodyweight
 * work, where 0 means no added weight.
 */
export function needsWeight(
  loadType: string,
  weight: number,
  lastSets: readonly unknown[] | undefined,
): boolean {
  return loadType !== "bodyweight" && weight === 0 && !lastSets?.length;
}

export interface UseSessionLoggerOptions {
  initial: LoggerSession;
  catalog: Catalog;
  /** Program slot targets by slot id. */
  targets: Record<string, SetTarget>;
  queue: SaveQueue;
}

/**
 * Logger state. Every edit is a queued mutation applied optimistically; a ref
 * holds the latest state so handlers never read a stale closure.
 */
export function useSessionLogger({
  initial,
  catalog,
  targets,
  queue,
}: UseSessionLoggerOptions) {
  const [session, setSession] = useState<LoggerSession>(initial);
  const sessionRef = useRef(initial);

  const commit = useCallback(
    (...mutations: Mutation[]) => {
      let next = sessionRef.current;
      for (const mutation of mutations) {
        next = applyMutation(next, mutation);
        queue.enqueue(mutation);
      }
      sessionRef.current = next;
      setSession(next);
    },
    [queue],
  );

  // After a reload (or navigating back) the server page may be older than the
  // changes still queued on this phone: lay those back on top once.
  useEffect(() => {
    const pending = queue.pendingFor(initial.id);
    if (pending.length === 0) return;
    const replayed = pending.reduce(applyMutation, sessionRef.current);
    sessionRef.current = replayed;
    setSession(replayed);
  }, [queue, initial.id]);

  const sessionId = initial.id;
  const locationId = () => sessionRef.current.locationId;

  const targetFor = (slotId: string | null) =>
    slotId ? (targets[slotId] ?? null) : null;

  const putSet = (
    exerciseRowId: string,
    set: ReturnType<typeof toSetInput>,
  ): Mutation => ({
    type: "putSet",
    sessionId,
    exerciseId: exerciseRowId,
    set,
  });

  const findRow = (exerciseRowId: string) =>
    sessionRef.current.exercises.find((e) => e.id === exerciseRowId);

  /** Starter sets for an exercise at the current location. */
  const newSets = (exerciseId: string | null, count: number) =>
    exerciseId
      ? suggestionsFor(catalog, locationId(), exerciseId, count)
      : Array.from({ length: count }, () => ({ weight: null, lastReps: null }));

  return {
    session,

    /**
     * Toggles done. Returns which field the caller should open an editor for
     * instead when the set cannot be saved as done yet.
     */
    toggleDone(exerciseRowId: string, setId: string): "weight" | "reps" | null {
      const row = findRow(exerciseRowId);
      const index = row?.sets.findIndex((s) => s.id === setId) ?? -1;
      if (!row || index === -1) return null;
      const set = row.sets[index];
      const lastSets = row.exerciseId
        ? catalog.lastSets[row.exerciseId]
        : undefined;
      if (!set.done && needsWeight(row.loadType, set.weight, lastSets)) {
        return "weight";
      }
      const next = toggleDone(set, {
        lastReps: lastRepsAt(lastSets, index),
        targetReps: targetReps(targetFor(row.slotId)),
        previousReps: row.sets[index - 1]?.reps ?? null,
      });
      if (next.done && next.reps === null) return "reps";
      commit(putSet(row.id, next));
      return null;
    },

    editSet(
      exerciseRowId: string,
      setId: string,
      change: { weight?: number; reps?: number | null },
    ) {
      const set = findRow(exerciseRowId)?.sets.find((s) => s.id === setId);
      if (!set) return;
      commit(putSet(exerciseRowId, { ...toSetInput(set), ...change }));
    },

    addSet(exerciseRowId: string) {
      const row = findRow(exerciseRowId);
      if (!row) return;
      const previous = row.sets.at(-1);
      commit(
        putSet(row.id, {
          id: newId(),
          position: (previous?.position ?? -1) + 1,
          weight: previous?.weight ?? 0,
          reps: null,
          done: false,
        }),
      );
    },

    removeSet(exerciseRowId: string, setId: string) {
      commit({
        type: "deleteSet",
        sessionId,
        exerciseId: exerciseRowId,
        setId,
      });
    },

    /** Adds an exercise (new row id) with starter sets; returns its row id. */
    addExercise(
      exerciseId: string,
      options: {
        slotId?: string | null;
        position?: number;
        sets?: number;
      } = {},
    ) {
      const exercise = findExercise(catalog, exerciseId);
      if (!exercise) return null;
      const rowId = newId();
      const position =
        options.position ??
        (sessionRef.current.exercises.at(-1)?.position ?? -1) + 1;
      const suggestions = newSets(exerciseId, options.sets ?? DEFAULT_NEW_SETS);
      commit(
        {
          type: "putExercise",
          sessionId,
          exercise: {
            id: rowId,
            exerciseId,
            slotId: options.slotId ?? null,
            position,
          },
          snapshot: {
            name: exercise.name,
            loadType: exercise.loadType,
            baseWeight: exercise.baseWeight,
          },
        },
        ...suggestions.map((suggestion, index) =>
          putSet(rowId, {
            id: newId(),
            position: index,
            weight: suggestion.weight ?? 0,
            reps: null,
            done: false,
          }),
        ),
      );
      return rowId;
    },

    /** Replaces an exercise in place: a fresh row, then the old one goes. */
    swapExercise(exerciseRowId: string, exerciseId: string) {
      const row = findRow(exerciseRowId);
      const exercise = findExercise(catalog, exerciseId);
      if (!row || !exercise || row.exerciseId === exerciseId) return;
      const rowId = newId();
      const suggestions = newSets(exerciseId, Math.max(1, row.sets.length));
      commit(
        {
          type: "putExercise",
          sessionId,
          exercise: {
            id: rowId,
            exerciseId,
            slotId: row.slotId,
            position: row.position,
          },
          snapshot: {
            name: exercise.name,
            loadType: exercise.loadType,
            baseWeight: exercise.baseWeight,
          },
        },
        ...suggestions.map((suggestion, index) =>
          putSet(rowId, {
            id: newId(),
            position: index,
            weight: suggestion.weight ?? 0,
            reps: null,
            done: false,
          }),
        ),
        { type: "deleteExercise", sessionId, exerciseId: exerciseRowId },
      );
    },

    removeExercise(exerciseRowId: string) {
      commit({ type: "deleteExercise", sessionId, exerciseId: exerciseRowId });
    },

    setLocation(nextLocationId: string) {
      commit({
        type: "patchSession",
        sessionId,
        patch: { locationId: nextLocationId },
      });
    },

    finish() {
      commit({
        type: "finish",
        sessionId,
        finishedAt: new Date().toISOString(),
      });
    },

    reopen() {
      commit({ type: "reopen", sessionId });
    },

    /** Weight chips and step for an exercise row at the current location. */
    weightOptions(exerciseId: string | null) {
      return weightListFor(
        catalog,
        session.locationId,
        findExercise(catalog, exerciseId),
      );
    },
  };
}
