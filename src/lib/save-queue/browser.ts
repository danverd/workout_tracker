"use client";

import { useSyncExternalStore } from "react";
import { createSaveQueue, EMPTY_SNAPSHOT, type SaveQueue } from "./queue";
import { sendMutation } from "./send";
import type { QueueSnapshot } from "./types";

let queue: SaveQueue | null = null;

/**
 * The page-wide queue. A module singleton, so changes still being sent keep
 * flushing when the owner navigates away from the logger.
 */
export function getBrowserQueue(): SaveQueue {
  if (!queue) {
    const inBrowser = typeof window !== "undefined";
    let storage: Storage | null = null;
    try {
      storage = inBrowser ? window.localStorage : null;
    } catch {
      storage = null;
    }
    queue = createSaveQueue({ send: sendMutation, storage });
    if (inBrowser) {
      const active = queue;
      window.addEventListener("online", () => active.retryNow());
      // Persist synchronously when the page may be going away.
      window.addEventListener("pagehide", () => active.flush());
      document.addEventListener("visibilitychange", () => {
        if (document.visibilityState === "hidden") active.flush();
      });
      active.start();
    }
  }
  return queue;
}

const serverSnapshot = () => EMPTY_SNAPSHOT;

/** Live queue status for `SaveStatus`. */
export function useQueueSnapshot(queueToWatch: SaveQueue): QueueSnapshot {
  return useSyncExternalStore(
    queueToWatch.subscribe,
    queueToWatch.getSnapshot,
    serverSnapshot,
  );
}
