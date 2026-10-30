"use client";

import Link from "next/link";
import { useState } from "react";
import type { SaveQueue } from "@/lib/save-queue/queue";
import { getBrowserQueue, useQueueSnapshot } from "@/lib/save-queue/browser";
import { buttonClass } from "@/ui/button-styles";
import { AppShell } from "@/ui/AppShell";
import { BottomSheet } from "@/ui/BottomSheet";
import { Button } from "@/ui/Button";
import { ChipGroup } from "@/ui/ChipGroup";
import { SaveStatus } from "@/ui/SaveStatus";
import { ScreenHeader } from "@/ui/ScreenHeader";
import { SetRow } from "@/ui/SetRow";
import { Stepper } from "@/ui/Stepper";
import type { SetTarget } from "@/types/domain";
import {
  availableExercises,
  findExercise,
  findLocation,
  formatLast,
  formatTarget,
  lastRepsAt,
  substitutesFor,
  targetReps,
  type Catalog,
} from "./catalog";
import { ExercisePicker } from "./ExercisePicker";
import type { LoggerSession } from "./state";
import { needsWeight, useSessionLogger } from "./useSessionLogger";

export interface SessionLoggerProps {
  initial: LoggerSession;
  catalog: Catalog;
  targets: Record<string, SetTarget>;
  /** Injected in tests; defaults to the page-wide browser queue. */
  queue?: SaveQueue;
}

type Editing = {
  exerciseRowId: string;
  setId: string;
  field: "weight" | "reps";
} | null;

type Picking = { kind: "swap"; exerciseRowId: string } | { kind: "add" } | null;

export function SessionLogger({
  initial,
  catalog,
  targets,
  queue,
}: SessionLoggerProps) {
  return (
    <LoggerBody
      initial={initial}
      catalog={catalog}
      targets={targets}
      queue={queue ?? getBrowserQueue()}
    />
  );
}

function LoggerBody({
  initial,
  catalog,
  targets,
  queue,
}: SessionLoggerProps & { queue: SaveQueue }) {
  const logger = useSessionLogger({ initial, catalog, targets, queue });
  const { session } = logger;
  const saving = useQueueSnapshot(queue);

  const [editing, setEditing] = useState<Editing>(null);
  const [picking, setPicking] = useState<Picking>(null);
  const [removing, setRemoving] = useState<string | null>(null);
  const [locationOpen, setLocationOpen] = useState(false);

  const finished = session.finishedAt !== null;
  const location = findLocation(catalog, session.locationId);
  const heading = session.dayName || session.title || "Workout";
  const available = new Set(
    availableExercises(catalog, session.locationId).map((e) => e.id),
  );

  const editedRow = editing
    ? session.exercises.find((e) => e.id === editing.exerciseRowId)
    : undefined;
  const editedSet = editedRow?.sets.find((s) => s.id === editing?.setId);
  const editedIndex =
    editedRow && editedSet ? editedRow.sets.indexOf(editedSet) : -1;
  const editedExercise = findExercise(catalog, editedRow?.exerciseId ?? null);

  const swapRow =
    picking?.kind === "swap"
      ? session.exercises.find((e) => e.id === picking.exerciseRowId)
      : undefined;
  const swapExercise = findExercise(catalog, swapRow?.exerciseId ?? null);

  const removingRow = session.exercises.find((e) => e.id === removing);
  const doneSets = session.exercises.reduce(
    (total, exercise) => total + exercise.sets.filter((s) => s.done).length,
    0,
  );

  return (
    <AppShell
      hideTabBar
      header={
        <ScreenHeader
          title={`${heading} · ${location?.name ?? "No location"}`}
          backHref="/"
          backLabel="Back to Today"
          action={
            finished ? (
              <Button variant="secondary" onClick={logger.reopen}>
                Reopen
              </Button>
            ) : (
              <Button variant="primary" onClick={logger.finish}>
                Finish
              </Button>
            )
          }
        />
      }
      footer={
        <div className="flex flex-col">
          <SaveStatus status={saving.status} />
          {saving.rejected ? (
            <p className="text-meta text-steel pb-1">
              A change was rejected: {saving.rejected} Reload to see what is
              saved.
            </p>
          ) : null}
        </div>
      }
    >
      <div className="flex items-center justify-between pb-2">
        <p className="text-meta text-rubber">{formatDate(session.date)}</p>
        <button
          type="button"
          onClick={() => setLocationOpen(true)}
          className="text-body text-plate-blue min-h-11 font-medium"
        >
          Change location
        </button>
      </div>

      {finished ? (
        <section
          aria-label="Session finished"
          className="border-hairline mb-3 flex flex-col items-start gap-3 border-y py-4"
        >
          <div>
            <p className="font-display text-title text-steel font-semibold">
              Session finished
            </p>
            <p className="text-body text-rubber">
              {doneSets} {doneSets === 1 ? "set" : "sets"} done across{" "}
              {session.exercises.length}{" "}
              {session.exercises.length === 1 ? "exercise" : "exercises"}.
            </p>
          </div>
          <Link href="/" className={buttonClass("primary")}>
            Back to Today
          </Link>
        </section>
      ) : null}

      {/* A finished session is read-only until it is reopened. */}
      <div inert={finished}>
        {session.exercises.length === 0 ? (
          <p className="text-body text-rubber py-4">
            No exercises yet. Add the first one below.
          </p>
        ) : null}
        {session.exercises.map((row) => {
          const exercise = findExercise(catalog, row.exerciseId);
          const target = row.slotId ? (targets[row.slotId] ?? null) : null;
          const lastSets = row.exerciseId
            ? catalog.lastSets[row.exerciseId]
            : undefined;
          const meta = [
            formatTarget(target, row.sets.length),
            formatLast(lastSets),
          ]
            .filter(Boolean)
            .join("   ");
          return (
            <section
              key={row.id}
              aria-label={row.name}
              className="border-hairline mb-3 border-b pb-1"
            >
              <h2 className="text-lead text-steel font-semibold">{row.name}</h2>
              <p className="text-meta text-rubber pb-1">{meta}</p>
              <div className="border-hairline border-t">
                {row.sets.map((set, index) => (
                  <SetRow
                    key={set.id}
                    index={index + 1}
                    weight={
                      needsWeight(row.loadType, set.weight, lastSets)
                        ? null
                        : set.weight
                    }
                    reps={set.reps}
                    repsHint={
                      lastRepsAt(lastSets, index) ??
                      targetReps(target) ??
                      undefined
                    }
                    done={set.done}
                    onToggleDone={() => {
                      const field = logger.toggleDone(row.id, set.id);
                      if (field)
                        setEditing({
                          exerciseRowId: row.id,
                          setId: set.id,
                          field,
                        });
                    }}
                    onEditWeight={() =>
                      setEditing({
                        exerciseRowId: row.id,
                        setId: set.id,
                        field: "weight",
                      })
                    }
                    onEditReps={() =>
                      setEditing({
                        exerciseRowId: row.id,
                        setId: set.id,
                        field: "reps",
                      })
                    }
                  />
                ))}
              </div>
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => logger.addSet(row.id)}
                  className="text-body text-plate-blue min-h-12 pr-3 font-medium"
                >
                  + Add set
                </button>
                <span className="flex-1" />
                <button
                  type="button"
                  onClick={() =>
                    setPicking({ kind: "swap", exerciseRowId: row.id })
                  }
                  className="text-body text-plate-blue min-h-12 px-3 font-medium"
                >
                  Swap
                </button>
                <button
                  type="button"
                  onClick={() => setRemoving(row.id)}
                  className="text-body text-rubber min-h-12 pl-3 font-medium"
                >
                  Remove
                </button>
              </div>
              {exercise ? null : (
                <p className="text-meta text-rubber">
                  This exercise was archived or deleted.
                </p>
              )}
            </section>
          );
        })}
        <Button variant="secondary" onClick={() => setPicking({ kind: "add" })}>
          Add exercise
        </Button>
      </div>

      <BottomSheet
        open={editing !== null && Boolean(editedSet)}
        onClose={() => setEditing(null)}
        title={
          editedRow ? `${editedRow.name}, set ${editedIndex + 1}` : "Edit set"
        }
      >
        {editing && editedRow && editedSet ? (
          <div className="flex flex-col gap-5">
            <ChipGroup
              label="Edit"
              options={[
                { value: "weight", label: "Weight" },
                { value: "reps", label: "Reps" },
              ]}
              value={[editing.field]}
              onChange={([field]) =>
                field &&
                setEditing({ ...editing, field: field as "weight" | "reps" })
              }
            />
            {editing.field === "weight" ? (
              <Stepper
                label="Weight"
                unit="lb"
                value={editedSet.weight}
                increment={editedExercise?.increment ?? 5}
                options={
                  logger.weightOptions(editedRow.exerciseId) ?? undefined
                }
                onChange={(weight) =>
                  logger.editSet(editedRow.id, editedSet.id, { weight })
                }
              />
            ) : (
              <Stepper
                label="Reps"
                value={editedSet.reps}
                increment={1}
                onChange={(reps) =>
                  logger.editSet(editedRow.id, editedSet.id, { reps })
                }
              />
            )}
            <div className="flex items-center justify-between">
              <Button
                variant="destructive"
                onClick={() => {
                  logger.removeSet(editedRow.id, editedSet.id);
                  setEditing(null);
                }}
              >
                Remove set
              </Button>
              <Button variant="secondary" onClick={() => setEditing(null)}>
                Done
              </Button>
            </div>
          </div>
        ) : null}
      </BottomSheet>

      <ExercisePicker
        open={picking !== null}
        title={picking?.kind === "swap" ? "Swap exercise" : "Add exercise"}
        onClose={() => setPicking(null)}
        onPick={(exerciseId) => {
          if (picking?.kind === "swap")
            logger.swapExercise(picking.exerciseRowId, exerciseId);
          else logger.addExercise(exerciseId);
        }}
        exercises={catalog.exercises}
        availableIds={available}
        candidateIds={
          swapRow
            ? substitutesFor(catalog, session.locationId, swapExercise)
            : []
        }
        currentId={swapRow?.exerciseId ?? null}
      />

      <BottomSheet
        open={removingRow !== undefined}
        onClose={() => setRemoving(null)}
        title="Remove exercise"
      >
        <div className="flex flex-col gap-4">
          <p className="text-body text-steel">
            Remove {removingRow?.name} and its {removingRow?.sets.length ?? 0}{" "}
            sets from this session?
          </p>
          <div className="flex items-center justify-between">
            <Button variant="secondary" onClick={() => setRemoving(null)}>
              Keep
            </Button>
            <Button
              variant="destructive"
              onClick={() => {
                if (removing) logger.removeExercise(removing);
                setRemoving(null);
              }}
            >
              Remove exercise
            </Button>
          </div>
        </div>
      </BottomSheet>

      <BottomSheet
        open={locationOpen}
        onClose={() => setLocationOpen(false)}
        title="Change location"
      >
        <div className="flex flex-col gap-3">
          <ChipGroup
            label="Location"
            options={catalog.locations.map((l) => ({
              value: l.id,
              label: l.name,
            }))}
            value={session.locationId ? [session.locationId] : []}
            onChange={([next]) => {
              if (next) logger.setLocation(next);
              setLocationOpen(false);
            }}
          />
          <p className="text-meta text-rubber">
            Applies to new suggestions and swaps. Exercises already in this
            session stay as they are.
          </p>
        </div>
      </BottomSheet>
    </AppShell>
  );
}

function formatDate(date: string) {
  return new Intl.DateTimeFormat("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  }).format(new Date(`${date}T12:00:00Z`));
}
