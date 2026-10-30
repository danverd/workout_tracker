"use client";

import { useState } from "react";
import { useAsyncAction } from "@/lib/use-async-action";
import { Button } from "@/ui/Button";

/**
 * Destructive action that needs a second tap, without a modal. `onConfirm`
 * may be async: a failure is shown under the button. On success the button
 * stays busy, since callers navigate away.
 */
export function ConfirmButton({
  label,
  confirmLabel = "Tap again to delete",
  onConfirm,
  disabled,
  block = true,
  errorFallback,
}: {
  label: string;
  confirmLabel?: string;
  onConfirm: () => void | Promise<unknown>;
  disabled?: boolean;
  block?: boolean;
  /** Message when the action fails without a server message. */
  errorFallback?: string;
}) {
  const [armed, setArmed] = useState(false);
  const { busy, error, run } = useAsyncAction(errorFallback);
  return (
    <div className="flex flex-col items-start gap-3">
      <Button
        variant="destructive"
        block={block}
        disabled={disabled || busy}
        onClick={async () => {
          if (!armed) return setArmed(true);
          const done = await run(async () => onConfirm(), { keepBusy: true });
          if (!done) setArmed(false);
        }}
        onBlur={() => setArmed(false)}
      >
        {armed ? confirmLabel : label}
      </Button>
      {error ? (
        <p role="alert" className="text-body text-bumper font-medium">
          {error}
        </p>
      ) : null}
    </div>
  );
}
