"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { ApiError } from "@/lib/api";
import type { SaveState } from "@/ui/SaveStatus";

const RETRY_MS = 4000;

type Options<T> = {
  initial: T;
  /** Sends the whole value to the server. */
  save: (value: T) => Promise<unknown>;
  /** Returns a message when the value cannot be saved yet, else null. */
  problem: (value: T) => string | null;
  delayMs?: number;
};

/**
 * Debounced whole-document autosave. Edits go through `update`, which is the
 * only trigger (no effect watches the value). Saves are serialised: an edit
 * made while a save is in flight is sent right after it finishes.
 */
export function useAutosave<T>({
  initial,
  save,
  problem,
  delayMs = 800,
}: Options<T>) {
  const [value, setValue] = useState(initial);
  const [status, setStatus] = useState<SaveState>("saved");
  const [error, setError] = useState<string | null>(null);
  const latest = useRef(initial);
  const dirty = useRef(false);
  const inflight = useRef(false);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const saveRef = useRef(save);
  const problemRef = useRef(problem);

  const flushRef = useRef<() => Promise<void>>(async () => {});

  useEffect(() => {
    saveRef.current = save;
    problemRef.current = problem;
    flushRef.current = async function run() {
      clearTimeout(timer.current);
      if (inflight.current || !dirty.current) return;
      if (problemRef.current(latest.current)) return;
      inflight.current = true;
      dirty.current = false;
      setStatus("saving");
      try {
        await saveRef.current(latest.current);
        setError(null);
        inflight.current = false;
        if (dirty.current) void flushRef.current();
        else setStatus("saved");
      } catch (caught) {
        inflight.current = false;
        dirty.current = true;
        setStatus("error");
        const retryable = caught instanceof ApiError ? caught.retryable : true;
        setError(
          retryable
            ? null
            : caught instanceof Error
              ? caught.message
              : "Could not save.",
        );
        if (retryable)
          timer.current = setTimeout(() => void flushRef.current(), RETRY_MS);
      }
    };
  });

  const flush = useCallback(() => flushRef.current(), []);

  const update = useCallback(
    (change: (current: T) => T) => {
      latest.current = change(latest.current);
      setValue(latest.current);
      dirty.current = true;
      clearTimeout(timer.current);
      if (problemRef.current(latest.current)) return;
      setStatus("saving");
      timer.current = setTimeout(() => void flush(), delayMs);
    },
    [delayMs, flush],
  );

  // Send pending edits when leaving the screen or hiding the page.
  useEffect(() => {
    const onHide = () => {
      if (document.visibilityState === "hidden") void flush();
    };
    document.addEventListener("visibilitychange", onHide);
    return () => {
      document.removeEventListener("visibilitychange", onHide);
      void flush();
    };
  }, [flush]);

  return { value, update, status, error };
}
