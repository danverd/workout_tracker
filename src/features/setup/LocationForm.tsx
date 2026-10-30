"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

import type { EquipmentRow, LocationRow } from "@/types/domain";
import { ConfirmButton } from "@/ui/ConfirmButton";

import {
  emptyWeightList,
  fromWeights,
  toWeights,
  type WeightListState,
} from "@/features/setup/weight-list";
import { WeightEditor } from "@/features/setup/WeightEditor";
import { ApiError, apiDelete, apiPatch, apiPost, apiPut } from "@/lib/api";
import { useAsyncAction } from "@/lib/use-async-action";
import { Button } from "@/ui/Button";
import { buttonClass } from "@/ui/button-styles";
import { ChipGroup } from "@/ui/ChipGroup";
import { TextField } from "@/ui/TextField";

export function LocationForm({
  equipment,
  location,
}: {
  equipment: EquipmentRow[];
  location?: LocationRow;
}) {
  const router = useRouter();
  const [name, setName] = useState(location?.name ?? "");
  const [selected, setSelected] = useState<string[]>(
    () => location?.equipment.map((item) => item.equipmentId) ?? [],
  );
  const [lists, setLists] = useState<Record<string, WeightListState>>(() => {
    const initial: Record<string, WeightListState> = {};
    for (const item of location?.equipment ?? []) {
      initial[item.equipmentId] = fromWeights(item.weights);
    }
    return initial;
  });
  const { busy, error, run: runAction } = useAsyncAction();
  const [nameError, setNameError] = useState<string | undefined>();

  if (equipment.length === 0) {
    return (
      <div className="flex flex-col items-start gap-4 py-10">
        <p className="text-lead text-steel max-w-[28ch]">
          Add your equipment first, then pick what this location has.
        </p>
        <Link href="/setup/equipment" className={buttonClass("primary")}>
          Add your equipment
        </Link>
      </div>
    );
  }

  const weighted = equipment.filter(
    (item) => item.hasWeights && selected.includes(item.id),
  );

  async function run(task: () => Promise<unknown>, after?: () => void) {
    setNameError(undefined);
    const ok = await runAction(task, {
      keepBusy: true,
      onError: (e) => {
        if (e instanceof ApiError && e.status === 409) {
          setNameError(e.message);
          return true;
        }
      },
    });
    if (!ok) return;
    (after ?? (() => router.push("/setup/locations")))();
    router.refresh();
  }

  function save(event: React.SyntheticEvent) {
    event.preventDefault();
    const body = {
      name,
      equipment: selected.map((equipmentId) => ({
        equipmentId,
        weights: toWeights(lists[equipmentId] ?? emptyWeightList),
      })),
    };
    void run(() =>
      location
        ? apiPut(`/api/locations/${location.id}`, body)
        : apiPost("/api/locations", body),
    );
  }

  return (
    <form onSubmit={save} className="flex flex-col gap-5">
      <TextField
        label="Name"
        value={name}
        onChange={(event) => setName(event.target.value)}
        placeholder="Home, Elm Street Gym…"
        error={nameError}
        autoComplete="off"
        autoFocus={!location}
      />

      <div className="flex flex-col gap-2">
        <p className="text-body text-steel font-medium">Equipment here</p>
        <ChipGroup
          label="Equipment at this location"
          multiple
          options={equipment.map((item) => ({
            value: item.id,
            label: item.name,
          }))}
          value={selected}
          onChange={setSelected}
        />
      </div>

      {weighted.map((item) => (
        <WeightEditor
          key={item.id}
          equipmentName={item.name}
          state={lists[item.id] ?? emptyWeightList}
          onChange={(state) =>
            setLists((current) => ({ ...current, [item.id]: state }))
          }
        />
      ))}

      {error ? (
        <p role="alert" className="text-meta text-bumper font-medium">
          {error}
        </p>
      ) : null}

      <div className="flex flex-col gap-3">
        <Button
          type="submit"
          variant="primary"
          block
          disabled={busy || !name.trim()}
        >
          {location ? "Save location" : "Add location"}
        </Button>
        {location ? (
          <>
            <Button
              block
              disabled={busy}
              onClick={() =>
                void run(() =>
                  apiPatch(`/api/locations/${location.id}`, {
                    archived: !location.archived,
                  }),
                )
              }
            >
              {location.archived ? "Restore location" : "Archive location"}
            </Button>
            {location.sessionCount === 0 ? (
              <ConfirmButton
                label="Delete location"
                disabled={busy}
                onConfirm={async () => {
                  await apiDelete(`/api/locations/${location.id}`);
                  router.push("/setup/locations");
                  router.refresh();
                }}
              />
            ) : (
              <p className="text-meta text-rubber">
                Past workouts used this location, so it can only be archived.
              </p>
            )}
          </>
        ) : null}
      </div>
    </form>
  );
}
