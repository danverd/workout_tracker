"use client";
/* eslint-disable react-hooks/set-state-in-effect -- effects synchronize server state and debounced persistence. */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { exercises, templates } from "@/lib/templates";
import { workoutApi } from "@/lib/workout-api";
import { makeExerciseFromCatalog } from "@/lib/workout-defaults";
import type { WorkoutPayload } from "@/types/workout";

export function useDailyWorkout(initialDate: string) {
  const [date, setDate] = useState(initialDate);
  const [workout, setWorkout] = useState<WorkoutPayload | null>(null);
  const [status, setStatus] = useState("Loading…");
  const [selectedTemplate, setSelectedTemplate] = useState(templates[0].slug);
  const [isLoading, setIsLoading] = useState(true);
  const [isCreating, setIsCreating] = useState(false);
  const [isFinishing, setIsFinishing] = useState(false);
  const workoutRef = useRef<WorkoutPayload | null>(null);
  const saveTimerRef = useRef<number | undefined>(undefined);
  const dirtyRef = useRef(false);
  const revisionRef = useRef(0);
  const loadRequestRef = useRef(0);
  const saveQueueRef = useRef(Promise.resolve(true));
  const creatingRef = useRef(false);
  const finishingRef = useRef(false);

  const load = useCallback(async () => {
    const requestId = ++loadRequestRef.current;
    setIsLoading(true);
    setStatus("Loading…");
    try {
      const { workout: loaded } = await workoutApi.getWorkout(date);
      if (requestId !== loadRequestRef.current) return;
      workoutRef.current = loaded;
      dirtyRef.current = false;
      setWorkout(loaded);
      setIsLoading(false);
      setStatus(loaded ? "Saved" : "");
    } catch {
      if (requestId !== loadRequestRef.current) return;
      setIsLoading(false);
      setStatus("Unable to load workout.");
    }
  }, [date]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (!workout || !dirtyRef.current) return;
    setStatus("Saving…");
    const timer = window.setTimeout(async () => {
      const revision = revisionRef.current;
      saveQueueRef.current = saveQueueRef.current.then(async () => {
        try {
          await workoutApi.saveWorkout(workout);
          if (revision === revisionRef.current) {
            dirtyRef.current = false;
            setStatus("Saved");
          }
          return true;
        } catch {
          if (revision === revisionRef.current) setStatus("Save failed");
          return false;
        }
      });
      await saveQueueRef.current;
    }, 550);
    saveTimerRef.current = timer;
    return () => window.clearTimeout(timer);
  }, [workout]);

  const update = useCallback((next: WorkoutPayload) => {
    workoutRef.current = next;
    dirtyRef.current = true;
    revisionRef.current += 1;
    setWorkout(next);
  }, []);

  const savePending = useCallback(async () => {
    const pending = workoutRef.current;
    if (!pending || !dirtyRef.current) return true;
    const revision = revisionRef.current;
    saveQueueRef.current = saveQueueRef.current.then(async () => {
      try {
        await workoutApi.saveWorkout(pending);
        if (revision === revisionRef.current) {
          dirtyRef.current = false;
          setStatus("Saved");
        }
        return true;
      } catch {
        if (revision === revisionRef.current) setStatus("Save failed");
        return false;
      }
    });
    return saveQueueRef.current;
  }, []);

  const create = useCallback(async () => {
    if (creatingRef.current) return;
    creatingRef.current = true;
    setIsCreating(true);
    loadRequestRef.current += 1;
    try {
      const created = await workoutApi.createWorkout(date, selectedTemplate);
      workoutRef.current = created;
      dirtyRef.current = false;
      revisionRef.current += 1;
      setWorkout(created);
      setIsLoading(false);
      setStatus("Saved");
    } catch {
      setStatus("Save failed");
    } finally {
      creatingRef.current = false;
      setIsCreating(false);
    }
  }, [date, selectedTemplate]);

  const changeDate = useCallback(
    async (nextDate: string) => {
      if (nextDate === date) return;
      if (saveTimerRef.current) window.clearTimeout(saveTimerRef.current);
      if (dirtyRef.current) {
        setStatus("Saving…");
        if (!(await savePending())) return;
      }
      loadRequestRef.current += 1;
      workoutRef.current = null;
      setWorkout(null);
      setIsLoading(true);
      setDate(nextDate);
    },
    [date, savePending],
  );

  const addExercise = useCallback(
    async (slug: string) => {
      const definition = exercises.find((item) => item.slug === slug);
      const current = workoutRef.current;
      if (!definition || !current) return;
      try {
        const { weights } = await workoutApi.getExerciseDefaults(slug, date);
        update({
          ...current,
          exercises: [
            ...current.exercises,
            makeExerciseFromCatalog(
              slug,
              current.exercises.length + 1,
              weights,
            ),
          ],
        });
      } catch {
        setStatus("Unable to load exercise defaults.");
      }
    },
    [date, update],
  );

  const finish = useCallback(async () => {
    if (!workoutRef.current || finishingRef.current) return;
    finishingRef.current = true;
    setIsFinishing(true);
    if (saveTimerRef.current) window.clearTimeout(saveTimerRef.current);
    if (dirtyRef.current) {
      setStatus("Saving…");
      if (!(await savePending())) {
        finishingRef.current = false;
        setIsFinishing(false);
        return;
      }
    }
    try {
      await workoutApi.finishWorkout(date);
      const finished = { ...workoutRef.current, status: "finished" as const };
      workoutRef.current = finished;
      setWorkout(finished);
      setStatus("Saved");
    } catch {
      setStatus("Save failed");
    } finally {
      finishingRef.current = false;
      setIsFinishing(false);
    }
  }, [date, savePending]);

  const availableExercises = useMemo(
    () =>
      exercises.filter(
        (item) =>
          !workout?.exercises.some((entry) => entry.exerciseSlug === item.slug),
      ),
    [workout],
  );

  return {
    date,
    workout,
    status,
    isLoading,
    isCreating,
    isFinishing,
    selectedTemplate,
    availableExercises,
    setSelectedTemplate,
    update,
    create,
    changeDate,
    addExercise,
    finish,
  };
}
