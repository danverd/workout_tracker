"use client";

import { useRouter } from "next/navigation";
import Link from "next/link";
import { useMemo, useState } from "react";

import {
  draftFromProgram,
  draftProblem,
  moveItem,
  newId,
  targetLabel,
  toPayload,
  type Draft,
  type DraftDay,
  type DraftSlot,
} from "@/features/programs/draft";
import {
  SlotEditor,
  type PickerExercise,
  type PickerMovement,
} from "@/features/programs/SlotEditor";
import { useAutosave } from "@/features/programs/use-autosave";
import { ApiError, apiPatch, apiPost, apiPut } from "@/lib/api";
import type { ProgramDto } from "@/types/domain";
import { AppShell } from "@/ui/AppShell";
import { BottomSheet } from "@/ui/BottomSheet";
import { Button } from "@/ui/Button";
import { ChevronDownIcon, PlusIcon } from "@/ui/icons";
import { IconButton } from "@/ui/IconButton";
import { SaveStatus } from "@/ui/SaveStatus";
import { ScreenHeader } from "@/ui/ScreenHeader";
import { TextField } from "@/ui/TextField";

export type ProgramBuilderProps = {
  program: ProgramDto;
  active: boolean;
  movements: readonly PickerMovement[];
  exercises: readonly PickerExercise[];
};

type SheetState = { dayId: string; slot: DraftSlot; isNew: boolean } | null;

const blankSlot = (): DraftSlot => ({
  id: newId(),
  movementId: null,
  exerciseId: null,
  targetSets: 3,
  repMin: 8,
  repMax: 12,
  amrap: false,
  notes: "",
});

function UpIcon() {
  return <ChevronDownIcon className="rotate-180" />;
}

export function ProgramBuilder({
  program,
  active: initialActive,
  movements,
  exercises,
}: ProgramBuilderProps) {
  const {
    value: draft,
    update,
    status,
    error,
  } = useAutosave<Draft>({
    initial: draftFromProgram(program),
    save: (value) => apiPut(`/api/programs/${program.id}`, toPayload(value)),
    problem: draftProblem,
  });
  const [active, setActive] = useState(initialActive);
  const router = useRouter();
  const [archived, setArchived] = useState(program.archived);
  const [sheet, setSheet] = useState<SheetState>(null);
  const [dayToDelete, setDayToDelete] = useState<DraftDay | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const problem = draftProblem(draft);
  const hasPickables = movements.length > 0 || exercises.length > 0;
  const lookup = useMemo(
    () => ({
      movements: new Map(movements.map((m) => [m.id, m.name])),
      exercises: new Map(exercises.map((x) => [x.id, x])),
    }),
    [movements, exercises],
  );

  function slotCopy(slot: DraftSlot) {
    if (slot.exerciseId) {
      const exercise = lookup.exercises.get(slot.exerciseId);
      const movement = exercise?.movementId
        ? lookup.movements.get(exercise.movementId)
        : null;
      return {
        title: exercise?.name ?? "Unavailable exercise",
        detail: [targetLabel(slot), movement].filter(Boolean).join(" · "),
      };
    }
    return {
      title: lookup.movements.get(slot.movementId ?? "") ?? "Unknown movement",
      detail: `${targetLabel(slot)} · any exercise`,
    };
  }

  function updateDay(dayId: string, change: (day: DraftDay) => DraftDay) {
    update((d) => ({
      ...d,
      days: d.days.map((day) => (day.id === dayId ? change(day) : day)),
    }));
  }

  function saveSlot(slot: DraftSlot) {
    if (!sheet) return;
    const { dayId, isNew } = sheet;
    updateDay(dayId, (day) => ({
      ...day,
      slots: isNew
        ? [...day.slots, slot]
        : day.slots.map((x) => (x.id === slot.id ? slot : x)),
    }));
    setSheet(null);
  }

  function deleteSlot() {
    if (!sheet) return;
    const { dayId, slot } = sheet;
    updateDay(dayId, (day) => ({
      ...day,
      slots: day.slots.filter((x) => x.id !== slot.id),
    }));
    setSheet(null);
  }

  async function runAction(action: () => Promise<void>) {
    setActionError(null);
    try {
      await action();
    } catch (caught) {
      setActionError(
        caught instanceof ApiError ? caught.message : "Something went wrong.",
      );
    }
  }

  const makeActive = () =>
    runAction(async () => {
      await apiPost(`/api/programs/${program.id}/active`);
      setActive(true);
      router.refresh();
    });

  const toggleArchived = () =>
    runAction(async () => {
      await apiPatch(`/api/programs/${program.id}/archive`, {
        archived: !archived,
      });
      setArchived(!archived);
      if (!archived) setActive(false);
      router.refresh();
    });

  return (
    <AppShell
      header={
        <ScreenHeader
          title={draft.name.trim() || "Program"}
          backHref="/programs"
          backLabel="Back to programs"
        />
      }
      footer={
        problem ? (
          <p
            role="status"
            className="text-meta text-steel flex min-h-8 items-center"
          >
            {problem}
          </p>
        ) : (
          <div>
            <SaveStatus status={status} />
            {error ? (
              <p role="alert" className="text-meta text-bumper pb-1">
                {error}
              </p>
            ) : null}
          </div>
        )
      }
    >
      <div className="flex flex-col gap-6">
        <section className="flex flex-col gap-3">
          <TextField
            label="Program name"
            value={draft.name}
            maxLength={80}
            error={
              draft.name.trim() === ""
                ? "Name the program to save it."
                : undefined
            }
            onChange={(e) => {
              const name = e.target.value;
              update((d) => ({ ...d, name }));
            }}
          />
          <div className="flex flex-wrap items-center gap-2">
            {archived ? (
              <p className="text-body text-rubber">Archived</p>
            ) : active ? (
              <p className="text-body text-plate-blue-deep font-medium">
                Active program. Today starts here.
              </p>
            ) : (
              <Button variant="secondary" onClick={makeActive}>
                Set as active
              </Button>
            )}
          </div>
          {actionError ? (
            <p role="alert" className="text-meta text-bumper font-medium">
              {actionError}
            </p>
          ) : null}
        </section>

        {hasPickables ? null : (
          <p className="text-body text-steel">
            There are no movements or exercises yet, so there is nothing to put
            in a day.{" "}
            <Link href="/setup" className="text-plate-blue underline">
              Add them in Setup
            </Link>
            .
          </p>
        )}

        {draft.days.length === 0 ? (
          <p className="text-body text-rubber">
            A program is made of days, like Push, Pull and Legs. Add your first
            day.
          </p>
        ) : null}

        {draft.days.map((day, dayIndex) => (
          <section
            key={day.id}
            aria-label={day.name || "Day"}
            className="border-hairline flex flex-col gap-3 border-t pt-4"
          >
            <div className="flex items-end gap-1">
              <div className="min-w-0 flex-1">
                <TextField
                  label="Day name"
                  value={day.name}
                  maxLength={80}
                  error={day.name.trim() === "" ? "Name this day." : undefined}
                  onChange={(e) => {
                    const name = e.target.value;
                    updateDay(day.id, (x) => ({ ...x, name }));
                  }}
                />
              </div>
              <IconButton
                label={`Move ${day.name || "day"} up`}
                icon={<UpIcon />}
                disabled={dayIndex === 0}
                onClick={() =>
                  update((d) => ({
                    ...d,
                    days: moveItem(d.days, dayIndex, -1),
                  }))
                }
              />
              <IconButton
                label={`Move ${day.name || "day"} down`}
                icon={<ChevronDownIcon />}
                disabled={dayIndex === draft.days.length - 1}
                onClick={() =>
                  update((d) => ({ ...d, days: moveItem(d.days, dayIndex, 1) }))
                }
              />
            </div>

            <ul className="border-hairline border-t">
              {day.slots.map((slot, slotIndex) => {
                const copy = slotCopy(slot);
                return (
                  <li
                    key={slot.id}
                    className="border-hairline flex items-center border-b"
                  >
                    <button
                      type="button"
                      onClick={() =>
                        setSheet({ dayId: day.id, slot, isNew: false })
                      }
                      className="flex min-h-14 min-w-0 flex-1 flex-col justify-center py-2 text-left"
                    >
                      <span className="text-lead text-steel truncate font-medium">
                        {copy.title}
                      </span>
                      <span className="text-meta text-rubber truncate">
                        {copy.detail}
                      </span>
                    </button>
                    <IconButton
                      label={`Move ${copy.title} up`}
                      icon={<UpIcon />}
                      disabled={slotIndex === 0}
                      onClick={() =>
                        updateDay(day.id, (x) => ({
                          ...x,
                          slots: moveItem(x.slots, slotIndex, -1),
                        }))
                      }
                    />
                    <IconButton
                      label={`Move ${copy.title} down`}
                      icon={<ChevronDownIcon />}
                      disabled={slotIndex === day.slots.length - 1}
                      onClick={() =>
                        updateDay(day.id, (x) => ({
                          ...x,
                          slots: moveItem(x.slots, slotIndex, 1),
                        }))
                      }
                    />
                  </li>
                );
              })}
            </ul>

            <div className="flex items-center justify-between">
              <Button
                variant="quiet"
                disabled={!hasPickables}
                onClick={() =>
                  setSheet({ dayId: day.id, slot: blankSlot(), isNew: true })
                }
              >
                <PlusIcon size={20} /> Add slot
              </Button>
              <Button variant="quiet" onClick={() => setDayToDelete(day)}>
                <span className="text-bumper">Delete day</span>
              </Button>
            </div>
          </section>
        ))}

        <Button
          variant="secondary"
          block
          disabled={draft.days.length >= 14}
          onClick={() =>
            update((d) => ({
              ...d,
              days: [...d.days, { id: newId(), name: "", slots: [] }],
            }))
          }
        >
          <PlusIcon size={20} /> Add day
        </Button>
        <Button variant="quiet" block onClick={toggleArchived}>
          {archived ? "Restore program" : "Archive program"}
        </Button>
      </div>

      <BottomSheet
        open={sheet !== null}
        onClose={() => setSheet(null)}
        title={sheet?.isNew ? "Add slot" : "Edit slot"}
      >
        {sheet ? (
          <SlotEditor
            key={sheet.slot.id}
            slot={sheet.slot}
            movements={movements}
            exercises={exercises}
            saveLabel={sheet.isNew ? "Add slot" : "Save slot"}
            onSave={saveSlot}
            onDelete={sheet.isNew ? undefined : deleteSlot}
          />
        ) : null}
      </BottomSheet>

      <BottomSheet
        open={dayToDelete !== null}
        onClose={() => setDayToDelete(null)}
        title={`Delete ${dayToDelete?.name || "this day"}?`}
      >
        <div className="flex flex-col gap-3 pb-2">
          <p className="text-body text-steel">
            This removes the day and its {dayToDelete?.slots.length ?? 0} slots.
            Past workouts keep their history.
          </p>
          <Button
            variant="destructive"
            block
            onClick={() => {
              const id = dayToDelete?.id;
              setDayToDelete(null);
              if (id)
                update((d) => ({
                  ...d,
                  days: d.days.filter((x) => x.id !== id),
                }));
            }}
          >
            Delete day
          </Button>
          <Button
            variant="secondary"
            block
            onClick={() => setDayToDelete(null)}
          >
            Keep day
          </Button>
        </div>
      </BottomSheet>
    </AppShell>
  );
}
