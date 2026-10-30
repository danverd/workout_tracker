import type { LoadType } from "@/types/domain";
import type {
  SessionExerciseInput,
  SessionPatchInput,
  SessionSetInput,
} from "@/lib/validation/sessions";

/**
 * One queued change. Every mutation is an idempotent upsert/delete keyed by a
 * client UUID, so re-sending after an ambiguous failure is always safe.
 */
export type Mutation =
  | {
      type: "putSet";
      sessionId: string;
      exerciseId: string;
      set: SessionSetInput;
    }
  | {
      type: "deleteSet";
      sessionId: string;
      exerciseId: string;
      setId: string;
    }
  | {
      type: "putExercise";
      sessionId: string;
      exercise: SessionExerciseInput;
      /**
       * Display snapshot kept client-side so a restored queue can be replayed
       * onto server state. Never sent to the server (it snapshots itself).
       */
      snapshot?: { name: string; loadType: LoadType; baseWeight: number };
    }
  | { type: "deleteExercise"; sessionId: string; exerciseId: string }
  | { type: "patchSession"; sessionId: string; patch: SessionPatchInput }
  | { type: "finish"; sessionId: string; finishedAt: string }
  | { type: "reopen"; sessionId: string };

export type MutationType = Mutation["type"];

export const MUTATION_TYPES: readonly MutationType[] = [
  "putSet",
  "deleteSet",
  "putExercise",
  "deleteExercise",
  "patchSession",
  "finish",
  "reopen",
];

export type SaveState = "saved" | "saving" | "error";

export interface QueueSnapshot {
  status: SaveState;
  /** Mutations not yet acknowledged by the server. */
  pending: number;
  /** True while waiting to retry after a network/5xx failure. */
  retrying: boolean;
  /** Set when a change was rejected (4xx) and dropped; cleared on next edit. */
  rejected: string | null;
}
