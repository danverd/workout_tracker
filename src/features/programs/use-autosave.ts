"use client";

import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react";

import { errorMessage } from "@/lib/api";
import { flushOnHide, isRetryable } from "@/lib/save-queue/retry";
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
  // `flush` runs from timers and event handlers, so it reads the newest
  // props through refs. `useEffectEvent` is the React 19.2 tool for this, but
  // its lint rule forbids calling it outside effects. The refs are updated in
  // a layout effect (not during render) so concurrent renders can't leak
  // props that never committed.
  const saveRef = useRef(save);
  const problemRef = useRef(problem);
  useLayoutEffect(() => {
    saveRef.current = save;
    problemRef.current = problem;
  });

  const flush = useCallback(async function run(): Promise<void> {
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
      if (dirty.current) void run();
      else setStatus("saved");
    } catch (caught) {
      inflight.current = false;
      dirty.current = true;
      setStatus("error");
      const retryable = isRetryable(caught);
      setError(retryable ? null : errorMessage(caught, "Could not save."));
      if (retryable) timer.current = setTimeout(() => void run(), RETRY_MS);
    }
  }, []);

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
    const stop = flushOnHide(() => void flush());
    return () => {
      stop();
      void flush();
    };
  }, [flush]);

  return { value, update, status, error, problem: problem(value) };
}
