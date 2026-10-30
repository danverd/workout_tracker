"use client";

import { useEffect } from "react";

import { getBrowserQueue } from "./browser";

/**
 * Renders nothing. Touching the page-wide queue singleton starts it, so a
 * persisted queue resumes on any screen after a reload.
 */
export function QueueFlusher() {
  useEffect(() => {
    getBrowserQueue();
  }, []);
  return null;
}
