import { ApiError } from "@/lib/api";

/**
 * Shared by the save queue and `useAutosave`: only network errors, 429 and
 * 5xx are worth retrying. Anything else (a 4xx, or a bug) will fail again.
 */
export function isRetryable(error: unknown): boolean {
  return error instanceof ApiError && error.retryable;
}

/**
 * Calls `flush` when the page is hidden or being unloaded, so pending work is
 * written or sent before it can be lost. Returns the cleanup function.
 */
export function flushOnHide(flush: () => void): () => void {
  const onVisibility = () => {
    if (document.visibilityState === "hidden") flush();
  };
  document.addEventListener("visibilitychange", onVisibility);
  window.addEventListener("pagehide", flush);
  return () => {
    document.removeEventListener("visibilitychange", onVisibility);
    window.removeEventListener("pagehide", flush);
  };
}
