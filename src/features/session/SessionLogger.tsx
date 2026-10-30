"use client";

import Link from "next/link";
import { useCallback, useState } from "react";
import type { SaveQueue } from "@/lib/save-queue/queue";
import { getBrowserQueue, useQueueSnapshot } from "@/lib/save-queue/browser";
import { buttonClass } from "@/ui/button-styles";
import { AppShell } from "@/ui/AppShell";
import { Button } from "@/ui/Button";
import { SaveStatus } from "@/ui/SaveStatus";
import { ScreenHeader } from "@/ui/ScreenHeader";
import { formatDay, plural } from "@/lib/format";
import type { SetTarget } from "@/types/domain";
import { findLocation, type Catalog } from "./catalog";
import { ExerciseCard } from "./ExerciseCard";
import { ExercisePickerSheet, type Picking } from "./ExercisePickerSheet";
import { LocationSheet } from "./LocationSheet";
import { RemoveExerciseSheet } from "./RemoveExerciseSheet";
import { SetEditorSheet, type Editing } from "./SetEditorSheet";
import type { LoggerSession } from "./state";
import { useSessionLogger } from "./useSessionLogger";

export interface SessionLoggerProps {
  initial: LoggerSession;
  catalog: Catalog;
  targets: Record<string, SetTarget>;
  /** Injected in tests; defaults to the page-wide browser queue. */
  queue?: SaveQueue;
}

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
  const { session, toggleDone, addSet } = logger;
  const saving = useQueueSnapshot(queue);

  const [editing, setEditing] = useState<Editing>(null);
  const [picking, setPicking] = useState<Picking>(null);
  const [removing, setRemoving] = useState<string | null>(null);
  const [locationOpen, setLocationOpen] = useState(false);

  const finished = session.finishedAt !== null;
  const location = findLocation(catalog, session.locationId);
  const heading = session.dayName || session.title || "Workout";

  const swapRow =
    picking?.kind === "swap"
      ? session.exercises.find((e) => e.id === picking.id)
      : undefined;
  const removingRow = session.exercises.find((e) => e.id === removing);
  const doneSets = session.exercises.reduce(
    (total, exercise) => total + exercise.sets.filter((s) => s.done).length,
    0,
  );

  const handleToggleDone = useCallback(
    (rowId: string, setId: string) => {
      const field = toggleDone(rowId, setId);
      if (field) setEditing({ exerciseRowId: rowId, setId, field });
    },
    [toggleDone],
  );
  const handleEditWeight = useCallback(
    (rowId: string, setId: string) =>
      setEditing({ exerciseRowId: rowId, setId, field: "weight" }),
    [],
  );
  const handleEditReps = useCallback(
    (rowId: string, setId: string) =>
      setEditing({ exerciseRowId: rowId, setId, field: "reps" }),
    [],
  );
  const handleSwap = useCallback(
    (id: string) => setPicking({ kind: "swap", id }),
    [],
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
        <p className="text-meta text-rubber">{formatDay(session.date)}</p>
        <button
          type="button"
          onClick={() => setLocationOpen(true)}
          className={buttonClass("quiet")}
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
              {plural(doneSets, "set")} done across{" "}
              {plural(session.exercises.length, "exercise")}.
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
        {session.exercises.map((row) => (
          <ExerciseCard
            key={row.id}
            row={row}
            catalog={catalog}
            target={row.slotId ? (targets[row.slotId] ?? null) : null}
            onToggleDone={handleToggleDone}
            onEditWeight={handleEditWeight}
            onEditReps={handleEditReps}
            onAddSet={addSet}
            onSwap={handleSwap}
            onRemove={setRemoving}
          />
        ))}
        <Button variant="secondary" onClick={() => setPicking({ kind: "add" })}>
          Add exercise
        </Button>
      </div>

      <SetEditorSheet
        editing={editing}
        session={session}
        catalog={catalog}
        onChangeField={(field) =>
          setEditing((current) => current && { ...current, field })
        }
        onEdit={logger.editSet}
        onRemoveSet={logger.removeSet}
        onClose={() => setEditing(null)}
      />

      <ExercisePickerSheet
        picking={picking}
        catalog={catalog}
        locationId={session.locationId}
        currentExerciseId={swapRow?.exerciseId ?? null}
        onClose={() => setPicking(null)}
        onPick={(exerciseId) => {
          if (picking?.kind === "swap")
            logger.swapExercise(picking.id, exerciseId);
          else logger.addExercise(exerciseId);
        }}
      />

      <RemoveExerciseSheet
        row={removingRow}
        onClose={() => setRemoving(null)}
        onRemove={logger.removeExercise}
      />

      <LocationSheet
        open={locationOpen}
        catalog={catalog}
        locationId={session.locationId}
        onPick={logger.setLocation}
        onClose={() => setLocationOpen(false)}
      />
    </AppShell>
  );
}
