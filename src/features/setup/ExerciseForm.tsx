"use client";

import { useRouter } from "next/navigation";
import { useRef, useState } from "react";

import { ConfirmButton } from "@/ui/ConfirmButton";

import { LoadTypePicker } from "@/features/setup/LoadTypePicker";
import { ApiError, apiDelete, apiPatch, apiPost, apiPut } from "@/lib/api";
import { useAsyncAction } from "@/lib/use-async-action";
import type {
  EquipmentRow,
  ExerciseRow,
  LoadType,
  MovementRow,
} from "@/types/domain";
import { Button } from "@/ui/Button";
import { ChipGroup } from "@/ui/ChipGroup";
import { NumberField } from "@/ui/NumberField";
import { TextField } from "@/ui/TextField";

const DEFAULT_BAR_WEIGHT = 45;

export function ExerciseForm({
  movements: initialMovements,
  equipment,
  exercise,
}: {
  movements: MovementRow[];
  equipment: EquipmentRow[];
  exercise?: ExerciseRow;
}) {
  const router = useRouter();
  const formRef = useRef<HTMLFormElement>(null);
  const [movements, setMovements] = useState(initialMovements);
  const [name, setName] = useState(exercise?.name ?? "");
  const [movementId, setMovementId] = useState<string | null>(
    exercise?.movementId ?? null,
  );
  const [equipmentIds, setEquipmentIds] = useState<string[]>(
    exercise?.equipmentIds ?? [],
  );
  const [loadType, setLoadType] = useState<LoadType>(
    exercise?.loadType ?? "total",
  );
  const [baseWeight, setBaseWeight] = useState<number | null>(
    exercise?.baseWeight ?? 0,
  );
  const [weightEquipmentId, setWeightEquipmentId] = useState<string | null>(
    exercise?.weightEquipmentId ?? null,
  );
  const [increment, setIncrement] = useState<number | null>(
    exercise?.increment ?? 5,
  );
  const [newMovement, setNewMovement] = useState("");
  const { busy, error, run } = useAsyncAction();
  const [nameError, setNameError] = useState<string | undefined>();
  const [notice, setNotice] = useState<string | null>(null);

  const weightChoices = equipment.filter(
    (item) => item.hasWeights && equipmentIds.includes(item.id),
  );
  // Derived: a weight list can only come from selected, weighted equipment.
  const effectiveWeightEquipment = weightChoices.some(
    (item) => item.id === weightEquipmentId,
  )
    ? weightEquipmentId
    : null;
  const valid = name.trim().length > 0 && increment !== null && increment > 0;

  function pickLoadType(next: LoadType) {
    setLoadType(next);
    if (next === "per_side" && !baseWeight) setBaseWeight(DEFAULT_BAR_WEIGHT);
  }

  async function addMovement() {
    const movementName = newMovement.trim();
    if (!movementName) return;
    await run(async () => {
      const row = await apiPost<MovementRow>("/api/movements", {
        name: movementName,
      });
      setMovements((current) => [...current, row]);
      setMovementId(row.id);
      setNewMovement("");
    });
  }

  async function save(another: boolean) {
    if (!valid || busy) return;
    setNameError(undefined);
    setNotice(null);
    const body = {
      name,
      movementId,
      loadType,
      baseWeight: loadType === "per_side" ? (baseWeight ?? 0) : 0,
      weightEquipmentId: effectiveWeightEquipment,
      increment,
      equipmentIds,
    };
    const saved = await run(
      () =>
        exercise
          ? apiPut(`/api/exercises/${exercise.id}`, body)
          : apiPost("/api/exercises", body),
      {
        keepBusy: !(another && !exercise),
        onError: (e) => {
          if (e instanceof ApiError && e.status === 409) {
            setNameError(e.message);
            return true;
          }
        },
      },
    );
    if (!saved) return;
    if (another && !exercise) {
      setNotice(`Saved ${name.trim()}. Add the next one.`);
      setName("");
      formRef.current
        ?.querySelector<HTMLInputElement>('input[name="exercise-name"]')
        ?.focus();
      router.refresh();
      return;
    }
    router.push("/setup/exercises");
    router.refresh();
  }

  async function archiveOrDelete(task: () => Promise<unknown>) {
    if (!(await run(task, { keepBusy: true }))) return;
    router.push("/setup/exercises");
    router.refresh();
  }

  return (
    <form
      ref={formRef}
      onSubmit={(event) => {
        event.preventDefault();
        void save(false);
      }}
      className="flex flex-col gap-6"
    >
      <TextField
        label="Name"
        name="exercise-name"
        value={name}
        onChange={(event) => setName(event.target.value)}
        placeholder="Incline dumbbell press"
        error={nameError}
        autoComplete="off"
        autoFocus={!exercise}
      />

      <div className="flex flex-col gap-2">
        <p className="text-body text-steel font-medium">Movement</p>
        {movements.length > 0 ? (
          <ChipGroup
            label="Movement"
            allowClear
            options={movements.map((m) => ({ value: m.id, label: m.name }))}
            value={movementId ? [movementId] : []}
            onChange={(value) => setMovementId(value[0] ?? null)}
          />
        ) : null}
        <div className="flex items-stretch gap-2">
          <TextField
            label="New movement"
            hideLabel
            value={newMovement}
            onChange={(event) => setNewMovement(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault();
                void addMovement();
              }
            }}
            placeholder="New movement, like Hinge"
            autoComplete="off"
          />
          <Button
            disabled={!newMovement.trim()}
            onClick={() => void addMovement()}
          >
            Add
          </Button>
        </div>
      </div>

      <div className="flex flex-col gap-2">
        <p className="text-body text-steel font-medium">Equipment needed</p>
        {equipment.length > 0 ? (
          <ChipGroup
            label="Required equipment"
            multiple
            options={equipment.map((e) => ({ value: e.id, label: e.name }))}
            value={equipmentIds}
            onChange={setEquipmentIds}
          />
        ) : (
          <p className="text-meta text-rubber">
            No equipment yet. Add some under Setup, then pick it here.
          </p>
        )}
      </div>

      <div className="flex flex-col gap-2">
        <p className="text-body text-steel font-medium">How you enter weight</p>
        <LoadTypePicker value={loadType} onChange={pickLoadType} />
      </div>

      {loadType === "per_side" ? (
        <NumberField
          label="Base weight"
          unit="lb"
          value={baseWeight}
          onChange={setBaseWeight}
          hint="The bar or sled before any plates. A barbell is usually 45."
        />
      ) : null}

      {weightChoices.length > 0 ? (
        <div className="flex flex-col gap-2">
          <p className="text-body text-steel font-medium">
            Weight list for the stepper
          </p>
          <ChipGroup
            label="Weight list for the stepper"
            allowClear
            options={weightChoices.map((e) => ({ value: e.id, label: e.name }))}
            value={effectiveWeightEquipment ? [effectiveWeightEquipment] : []}
            onChange={(value) => setWeightEquipmentId(value[0] ?? null)}
          />
          <p className="text-meta text-rubber">
            Optional. Weights snap to what this equipment offers at each
            location.
          </p>
        </div>
      ) : null}

      <NumberField
        label="Increment"
        unit="lb"
        value={increment}
        onChange={setIncrement}
        hint="Step size when there is no weight list."
      />

      {notice ? (
        <p role="status" className="text-body text-plate-blue-deep font-medium">
          {notice}
        </p>
      ) : null}
      {error ? (
        <p role="alert" className="text-meta text-bumper font-medium">
          {error}
        </p>
      ) : null}

      <div className="border-hairline bg-chalk sticky bottom-[calc(3.5rem+env(safe-area-inset-bottom))] z-20 -mx-4 flex flex-col gap-2 border-t px-4 py-3">
        <Button type="submit" variant="primary" block disabled={!valid || busy}>
          Save exercise
        </Button>
        {exercise ? null : (
          <Button
            block
            disabled={!valid || busy}
            onClick={() => void save(true)}
          >
            Save and add another
          </Button>
        )}
      </div>

      {exercise ? (
        <div className="flex flex-col gap-3">
          <Button
            block
            disabled={busy}
            onClick={() =>
              void archiveOrDelete(() =>
                apiPatch(`/api/exercises/${exercise.id}`, {
                  archived: !exercise.archived,
                }),
              )
            }
          >
            {exercise.archived ? "Restore exercise" : "Archive exercise"}
          </Button>
          {exercise.usage ? (
            <p className="text-meta text-rubber">
              Used in {exercise.usage}, so it can only be archived.
            </p>
          ) : (
            <ConfirmButton
              label="Delete exercise"
              disabled={busy}
              onConfirm={async () => {
                await apiDelete(`/api/exercises/${exercise.id}`);
                router.push("/setup/exercises");
                router.refresh();
              }}
            />
          )}
        </div>
      ) : null}
    </form>
  );
}
