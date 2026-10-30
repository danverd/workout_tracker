"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { apiDelete } from "@/lib/api";
import { Button } from "@/ui/Button";

export function DeleteCardioButton({ id }: { id: string }) {
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function remove() {
    setBusy(true);
    setError(null);
    try {
      await apiDelete(`/api/cardio/${id}`);
      router.replace("/history");
      router.refresh();
    } catch {
      setError("Couldn't delete this entry. Try again.");
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col items-start gap-3">
      {confirming ? (
        <div className="flex gap-3">
          <Button variant="destructive" onClick={remove} disabled={busy}>
            Delete cardio
          </Button>
          <Button
            variant="quiet"
            onClick={() => setConfirming(false)}
            disabled={busy}
          >
            Keep it
          </Button>
        </div>
      ) : (
        <Button variant="destructive" onClick={() => setConfirming(true)}>
          Delete
        </Button>
      )}
      {error ? (
        <p role="alert" className="text-body text-bumper font-medium">
          {error}
        </p>
      ) : null}
    </div>
  );
}
