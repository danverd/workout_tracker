"use client";

import { useState } from "react";

import { apiPut } from "@/lib/api";
import { useAsyncAction } from "@/lib/use-async-action";
import { Button } from "@/ui/Button";
import { NumberField } from "@/ui/NumberField";
import { SaveStatus } from "@/ui/SaveStatus";

export function SettingsForm({ bodyweightLb }: { bodyweightLb: number }) {
  const [value, setValue] = useState<number | null>(bodyweightLb || null);
  const [saved, setSaved] = useState(false);
  const { busy, error, run } = useAsyncAction();
  const state = busy ? "saving" : error ? "error" : saved ? "saved" : null;

  async function save(event: React.SyntheticEvent) {
    event.preventDefault();
    if (value === null) return;
    setSaved(false);
    setSaved(await run(() => apiPut("/api/settings", { bodyweightLb: value })));
  }

  return (
    <form onSubmit={save} className="flex flex-col gap-4">
      <NumberField
        label="Bodyweight"
        unit="lb"
        value={value}
        onChange={(next) => {
          setValue(next);
          setSaved(false);
        }}
        hint="Used for bodyweight and assisted exercises. Past workouts keep the weight they were logged with."
      />
      <Button
        type="submit"
        variant="primary"
        block
        disabled={value === null || busy}
      >
        Save bodyweight
      </Button>
      {state ? <SaveStatus status={state} /> : null}
      {error ? (
        <p role="alert" className="text-meta text-bumper font-medium">
          {error}
        </p>
      ) : null}
    </form>
  );
}
