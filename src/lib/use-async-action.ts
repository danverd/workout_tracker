"use client";

import { useCallback, useState } from "react";
import { errorMessage } from "@/lib/api";

export interface RunOptions {
  /** Leave `busy` set after success (the caller is navigating away). */
  keepBusy?: boolean;
  /** Return true to handle the error yourself and skip the shared message. */
  onError?: (error: unknown) => boolean | void;
}

/** Busy and error state for a user-triggered async action. */
export function useAsyncAction(fallback?: string) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const run = useCallback(
    async (action: () => Promise<unknown>, options: RunOptions = {}) => {
      setBusy(true);
      setError(null);
      try {
        await action();
        if (!options.keepBusy) setBusy(false);
        return true;
      } catch (caught) {
        if (options.onError?.(caught) !== true)
          setError(errorMessage(caught, fallback));
        setBusy(false);
        return false;
      }
    },
    [fallback],
  );

  return { busy, error, run, setError };
}
