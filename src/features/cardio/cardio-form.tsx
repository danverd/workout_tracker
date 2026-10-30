"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { getBrowserQueue } from "@/lib/save-queue/browser";
import { useAsyncAction } from "@/lib/use-async-action";
import type { CardioInput } from "@/lib/validation/sessions";
import type { DistanceUnit } from "@/types/domain";
import { Button } from "@/ui/Button";
import { ChipGroup } from "@/ui/ChipGroup";
import { NumberField } from "@/ui/NumberField";
import { TextField } from "@/ui/TextField";

const DEFAULT_ACTIVITIES = ["Walk", "Treadmill", "Row"];

export function CardioForm({ recent }: { recent: string[] }) {
  const router = useRouter();
  // One id per form visit: a retried save replays the same idempotent PUT.
  const [id] = useState(() => crypto.randomUUID());
  const [activity, setActivity] = useState("");
  const [minutes, setMinutes] = useState<number | null>(null);
  const [distance, setDistance] = useState<number | null>(null);
  const [unit, setUnit] = useState<DistanceUnit>("mi");
  const [notes, setNotes] = useState("");
  const { busy: saving, error, run, setError } = useAsyncAction();

  const chips = recent.length > 0 ? recent : DEFAULT_ACTIVITIES;
  const canSave = activity.trim().length > 0 && !saving;

  async function save() {
    const body: Omit<CardioInput, "date" | "startedAt"> = {
      id,
      locationId: null,
      activity: activity.trim(),
      durationSec: minutes === null ? null : Math.round(minutes * 60),
      distance,
      distanceUnit: distance === null ? null : unit,
      notes: notes.trim(),
    };
    // The queue persists the save and retries it, so it survives a bad
    // connection or a closed tab. Wait for the first attempt: online, the Today
    // page then already shows the entry; offline, it saves later.
    const queue = getBrowserQueue();
    const sent = await run(async () => {
      queue.enqueue({ type: "putCardio", sessionId: id, cardio: body });
      await queue.idle();
    });
    if (!sent) return;
    const { rejected } = queue.getSnapshot();
    if (rejected) {
      setError(rejected);
      return;
    }
    router.push("/");
    router.refresh();
  }

  return (
    <form
      className="flex flex-col gap-5"
      onSubmit={(event) => {
        event.preventDefault();
        if (canSave) void save();
      }}
    >
      <div className="flex flex-col gap-3">
        <TextField
          label="Activity"
          value={activity}
          maxLength={80}
          placeholder="Walk, run, bike…"
          onChange={(event) => setActivity(event.target.value)}
        />
        <ChipGroup
          label="Recent activities"
          options={chips.map((name) => ({ value: name }))}
          value={activity ? [activity] : []}
          allowClear
          onChange={(value) => setActivity(value[0] ?? "")}
        />
      </div>
      <NumberField
        label="Duration"
        unit="min"
        value={minutes}
        onChange={setMinutes}
      />
      <div className="flex flex-col gap-3">
        <NumberField
          label="Distance (optional)"
          value={distance}
          onChange={setDistance}
        />
        <ChipGroup
          label="Distance unit"
          options={[{ value: "mi" }, { value: "km" }]}
          value={[unit]}
          onChange={(value) => setUnit((value[0] as DistanceUnit) ?? "mi")}
        />
      </div>
      <TextField
        label="Notes (optional)"
        value={notes}
        maxLength={2000}
        onChange={(event) => setNotes(event.target.value)}
      />
      {error ? (
        <p role="alert" className="text-body text-bumper font-medium">
          {error}
        </p>
      ) : null}
      <Button type="submit" variant="primary" block disabled={!canSave}>
        {saving ? "Saving…" : "Save cardio"}
      </Button>
    </form>
  );
}
