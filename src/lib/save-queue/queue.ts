import { ApiError } from "@/lib/api";
import type { SaveState } from "@/ui/SaveStatus";
import { isRetryable } from "./retry";
import { MUTATION_TYPES, type Mutation, type QueueSnapshot } from "./types";

/** Bump when the persisted shape changes; old payloads are then ignored. */
export const QUEUE_STORAGE_KEY = "workout-tracker:save-queue:v1";
const STORAGE_VERSION = 1;

export type StorageLike = Pick<Storage, "getItem" | "setItem" | "removeItem">;

export interface SaveQueueOptions {
  /** Delivers one mutation; rejects with `ApiError` on failure. */
  send: (mutation: Mutation) => Promise<void>;
  /** Where to persist pending work; null/undefined disables persistence. */
  storage?: StorageLike | null;
  storageKey?: string;
  /** First retry delay; doubles per consecutive failure. Default 1s. */
  baseDelayMs?: number;
  /** Retry delay ceiling. Default 30s. */
  maxDelayMs?: number;
}

/** Server-render snapshot: nothing pending. */
export const EMPTY_SNAPSHOT: QueueSnapshot = {
  status: "saved",
  pending: 0,
  retrying: false,
  authRequired: false,
  rejected: null,
};

/**
 * 401 (signed out) and 403 (origin check) say nothing about the change itself,
 * so dropping it would lose data. Keep it and retry once signed back in.
 */
function isAuthError(error: unknown): boolean {
  return (
    error instanceof ApiError && (error.status === 401 || error.status === 403)
  );
}

function isMutation(value: unknown): value is Mutation {
  if (!value || typeof value !== "object") return false;
  const candidate = value as { type?: unknown; sessionId?: unknown };
  return (
    typeof candidate.sessionId === "string" &&
    MUTATION_TYPES.includes(candidate.type as Mutation["type"])
  );
}

/** Folds `next` into the tail mutation when they target the same row. */
function coalesce(tail: Mutation | undefined, next: Mutation): Mutation | null {
  if (!tail || tail.sessionId !== next.sessionId) return null;
  switch (next.type) {
    case "putSet":
      return tail.type === "putSet" && tail.set.id === next.set.id
        ? next
        : null;
    case "putExercise":
      return tail.type === "putExercise" &&
        tail.exercise.id === next.exercise.id
        ? { ...next, snapshot: next.snapshot ?? tail.snapshot }
        : null;
    case "patchSession":
      return tail.type === "patchSession"
        ? { ...next, patch: { ...tail.patch, ...next.patch } }
        : null;
    case "putCardio":
      return tail.type === "putCardio" ? next : null;
    case "finish":
    case "reopen":
      return tail.type === "finish" || tail.type === "reopen" ? next : null;
    default:
      return null;
  }
}

/**
 * Ordered, one-at-a-time queue of idempotent mutations (design §7, §13.4).
 * Framework-agnostic: subscribe/getSnapshot fit `useSyncExternalStore`.
 *
 * - A mutation stays queued (and persisted) until the server acknowledges it.
 * - Network errors, 5xx/429 and 401/403 retry the same head item with
 *   exponential backoff, or immediately on `retryNow()` (wired to the `online`
 *   event and to signing in). 401/403 also set `authRequired`.
 * - Any other 4xx drops that mutation, records `rejected`, and moves on.
 */
export function createSaveQueue(options: SaveQueueOptions) {
  const {
    send,
    storage = null,
    storageKey = QUEUE_STORAGE_KEY,
    baseDelayMs = 1000,
    maxDelayMs = 30_000,
  } = options;

  const items: Mutation[] = restore();
  let inFlight: Mutation | null = null;
  let running = false;
  let failures = 0;
  let retrying = false;
  let authRequired = false;
  let rejected: string | null = null;
  let persistScheduled = false;
  let timer: ReturnType<typeof setTimeout> | null = null;
  let snapshot: QueueSnapshot = computeSnapshot();
  const listeners = new Set<() => void>();

  function restore(): Mutation[] {
    try {
      const raw = storage?.getItem(storageKey);
      if (!raw) return [];
      const parsed: unknown = JSON.parse(raw);
      if (
        !parsed ||
        typeof parsed !== "object" ||
        (parsed as { version?: unknown }).version !== STORAGE_VERSION
      )
        return [];
      const saved = (parsed as { items?: unknown }).items;
      return Array.isArray(saved) ? saved.filter(isMutation) : [];
    } catch {
      return [];
    }
  }

  /**
   * Coalesces writes to one per microtask. `flush()` writes immediately, so
   * pagehide can persist synchronously.
   */
  function persist() {
    if (!storage || persistScheduled) return;
    persistScheduled = true;
    queueMicrotask(flush);
  }

  function flush() {
    persistScheduled = false;
    if (!storage) return;
    try {
      if (items.length === 0) storage.removeItem(storageKey);
      else
        storage.setItem(
          storageKey,
          JSON.stringify({ version: STORAGE_VERSION, items }),
        );
    } catch {
      // Storage full or blocked: the in-memory queue still works.
    }
  }

  function computeSnapshot(): QueueSnapshot {
    const status: SaveState =
      retrying || rejected ? "error" : items.length > 0 ? "saving" : "saved";
    return { status, pending: items.length, retrying, authRequired, rejected };
  }

  function emit() {
    const next = computeSnapshot();
    if (
      next.status !== snapshot.status ||
      next.pending !== snapshot.pending ||
      next.retrying !== snapshot.retrying ||
      next.authRequired !== snapshot.authRequired ||
      next.rejected !== snapshot.rejected
    ) {
      snapshot = next;
      for (const listener of listeners) listener();
    }
  }

  function clearTimer() {
    if (timer !== null) clearTimeout(timer);
    timer = null;
  }

  async function run() {
    if (running) return;
    running = true;
    try {
      while (items.length > 0) {
        const head = items[0];
        inFlight = head;
        try {
          await send(head);
        } catch (error) {
          inFlight = null;
          const signedOut = isAuthError(error);
          if (signedOut || isRetryable(error)) {
            failures += 1;
            retrying = true;
            authRequired = signedOut;
            emit();
            const delay = Math.min(
              maxDelayMs,
              baseDelayMs * 2 ** (failures - 1),
            );
            timer = setTimeout(() => {
              timer = null;
              void run();
            }, delay);
            return;
          }
          // Not retryable (4xx or a bug): drop it so the rest can proceed.
          items.shift();
          rejected =
            error instanceof Error ? error.message : "A change was rejected.";
          persist();
          emit();
          continue;
        }
        inFlight = null;
        items.shift();
        failures = 0;
        retrying = false;
        authRequired = false;
        persist();
        emit();
      }
    } finally {
      running = false;
    }
  }

  function append(mutation: Mutation) {
    const tail = items.at(-1);
    const merged = tail && tail !== inFlight ? coalesce(tail, mutation) : null;
    if (merged) items[items.length - 1] = merged;
    else items.push(mutation);
  }

  return {
    /** Appends a mutation (or folds it into the tail) and starts sending. */
    enqueue(mutation: Mutation) {
      append(mutation);
      rejected = null;
      persist();
      emit();
      if (timer === null) void run();
    },
    /** Like `enqueue` for several mutations: one persist, one emit. */
    enqueueMany(mutations: readonly Mutation[]) {
      if (mutations.length === 0) return;
      for (const mutation of mutations) append(mutation);
      rejected = null;
      persist();
      emit();
      if (timer === null) void run();
    },
    /** Writes pending work to storage now (pagehide / tab hidden). */
    flush,
    /** Sends now, skipping any backoff wait (e.g. on the `online` event). */
    retryNow() {
      clearTimer();
      void run();
    },
    /** Resumes work restored from storage. */
    start() {
      if (items.length > 0 && timer === null) void run();
    },
    /** Pending mutations for a session, oldest first. */
    pendingFor(sessionId: string): Mutation[] {
      return items.filter((item) => item.sessionId === sessionId);
    },
    subscribe(listener: () => void) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    getSnapshot: () => snapshot,
    /** Resolves once the queue is empty or stuck waiting to retry. */
    async idle() {
      while (running) await new Promise((resolve) => setTimeout(resolve, 0));
    },
  };
}

export type SaveQueue = ReturnType<typeof createSaveQueue>;
