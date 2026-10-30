"use client";

import { useState } from "react";

import { errorMessage } from "@/features/setup/errors";
import { apiPut } from "@/lib/api";
import { Button } from "@/ui/Button";
import { NumberField } from "@/ui/NumberField";
import { SaveStatus } from "@/ui/SaveStatus";

export function SettingsForm({ bodyweightLb }: { bodyweightLb: number }) {
  const [value, setValue] = useState<number | null>(bodyweightLb || null);
  const [state, setState] = useState<"saved" | "saving" | "error" | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function save(event: React.SyntheticEvent) {
    event.preventDefault();
    if (value === null) return;
    setState("saving");
    setError(null);
    try {
      await apiPut("/api/settings", { bodyweightLb: value });
      setState("saved");
    } catch (e) {
      setError(errorMessage(e));
      setState("error");
    }
  }

  return (
    <form onSubmit={save} className="flex flex-col gap-4">
      <NumberField
        label="Bodyweight"
        unit="lb"
        value={value}
        onChange={(next) => {
          setValue(next);
          setState(null);
        }}
        hint="Used for bodyweight and assisted exercises. Past workouts keep the weight they were logged with."
      />
      <Button
        type="submit"
        variant="primary"
        block
        disabled={value === null || state === "saving"}
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
