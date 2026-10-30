"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { apiPut } from "@/lib/api";
import { buttonClass } from "@/ui/button-styles";
import { Button } from "@/ui/Button";
import { EmptyState } from "@/ui/EmptyState";
import { MinusIcon, PlusIcon } from "@/ui/icons";
import { IconButton } from "@/ui/IconButton";
import { Select } from "@/ui/Select";
import {
  availableExercises,
  findExercise,
  formatLast,
  formatTarget,
  newId,
  substitutesFor,
  type Catalog,
} from "./catalog";
import { ExercisePicker } from "./ExercisePicker";
import {
  buildCreateInput,
  buildPreviewItems,
  dayChoice,
  DEFAULT_SET_COUNT,
  defaultDayChoice,
  defaultLocationId,
  FREESTYLE,
  parseDayChoice,
  type PreviewItem,
} from "./preview";

const MAX_SETS = 12;

type Picking = { kind: "swap"; key: string } | { kind: "add" } | null;

export function NewSession({ catalog }: { catalog: Catalog }) {
  const router = useRouter();
  const [locationId, setLocationId] = useState(() =>
    defaultLocationId(catalog),
  );
  const [choice, setChoice] = useState(() => defaultDayChoice(catalog));
  const [items, setItems] = useState<PreviewItem[]>(() =>
    buildPreviewItems(
      catalog,
      defaultLocationId(catalog),
      parseDayChoice(catalog, defaultDayChoice(catalog))?.day ?? null,
    ),
  );
  const [picking, setPicking] = useState<Picking>(null);
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (catalog.locations.length === 0 || catalog.exercises.length === 0) {
    return (
      <EmptyState
        message="Add a location and a few exercises before you start lifting."
        action={
          <Link href="/setup" className={buttonClass("secondary")}>
            Go to Setup
          </Link>
        }
      />
    );
  }

  const selected = parseDayChoice(catalog, choice);
  const available = new Set(
    availableExercises(catalog, locationId).map((e) => e.id),
  );
  const unresolved = items.filter((item) => item.exerciseId === null).length;

  function reresolve(nextLocation: string | null, nextChoice: string) {
    setItems(
      buildPreviewItems(
        catalog,
        nextLocation,
        parseDayChoice(catalog, nextChoice)?.day ?? null,
      ),
    );
  }

  function updateItem(key: string, change: Partial<PreviewItem>) {
    setItems((current) =>
      current.map((item) => (item.key === key ? { ...item, ...change } : item)),
    );
  }

  function pick(exerciseId: string) {
    if (picking?.kind === "swap")
      updateItem(picking.key, { exerciseId, status: "resolved" });
    else if (picking?.kind === "add")
      setItems((current) => [
        ...current,
        {
          key: newId(),
          slotId: null,
          exerciseId,
          status: "added",
          label: null,
          candidateIds: [],
          target: null,
          sets: DEFAULT_SET_COUNT,
        },
      ]);
  }

  async function start() {
    if (starting) return;
    setStarting(true);
    setError(null);
    const sessionId = newId();
    try {
      await apiPut(
        `/api/sessions/${sessionId}`,
        buildCreateInput({
          catalog,
          sessionId,
          locationId,
          program: selected?.program ?? null,
          day: selected?.day ?? null,
          items,
          startedAt: new Date().toISOString(),
        }),
      );
      router.push(`/session/${sessionId}`);
    } catch (caught) {
      setStarting(false);
      setError(
        caught instanceof Error
          ? `${caught.message} Nothing was started. Try again.`
          : "Couldn't start the session. Try again.",
      );
    }
  }

  const swapItem =
    picking?.kind === "swap"
      ? items.find((item) => item.key === picking.key)
      : undefined;

  const swapCandidates = swapItem
    ? [
        ...new Set([
          ...swapItem.candidateIds,
          ...substitutesFor(
            catalog,
            locationId,
            findExercise(catalog, swapItem.exerciseId),
          ),
        ]),
      ]
    : [];

  return (
    <div className="flex flex-col gap-4 pb-20">
      <Select
        label="Location"
        value={locationId ?? ""}
        onChange={(event) => {
          setLocationId(event.target.value);
          reresolve(event.target.value, choice);
        }}
        options={catalog.locations.map((l) => ({ value: l.id, label: l.name }))}
      />
      <Select
        label="Day"
        value={choice}
        onChange={(event) => {
          setChoice(event.target.value);
          reresolve(locationId, event.target.value);
        }}
        options={dayOptions(catalog)}
      />
      {catalog.programs.length === 0 ? (
        <p className="text-body text-rubber">
          No programs yet.{" "}
          <Link href="/programs" className="text-plate-blue underline">
            Build one in Programs
          </Link>{" "}
          or lift freestyle.
        </p>
      ) : null}

      <section aria-label="Exercises">
        {items.length === 0 ? (
          <p className="text-body text-rubber border-hairline border-t py-4">
            {choice === FREESTYLE
              ? "Freestyle starts empty. Add the exercises you want."
              : "This day has no exercises yet. Add some, or edit the day in Programs."}
          </p>
        ) : (
          <ul className="border-hairline border-t">
            {items.map((item) => (
              <PreviewRow
                key={item.key}
                item={item}
                catalog={catalog}
                onSwap={() => setPicking({ kind: "swap", key: item.key })}
                onRemove={() =>
                  setItems((current) =>
                    current.filter((other) => other.key !== item.key),
                  )
                }
                onSets={(sets) => updateItem(item.key, { sets })}
              />
            ))}
          </ul>
        )}
        <div className="pt-3">
          <Button
            variant="secondary"
            onClick={() => setPicking({ kind: "add" })}
          >
            Add exercise
          </Button>
        </div>
      </section>

      {error ? (
        <p
          role="alert"
          className="text-body text-steel bg-plate-yellow-wash p-3"
        >
          {error}
        </p>
      ) : null}
      {unresolved > 0 ? (
        <p className="text-meta text-rubber">
          {unresolved === 1
            ? "1 line has no exercise here and will be skipped."
            : `${unresolved} lines have no exercise here and will be skipped.`}{" "}
          Choose one to include it.
        </p>
      ) : null}

      <div className="border-hairline bg-chalk fixed inset-x-0 bottom-[calc(3.5rem+env(safe-area-inset-bottom))] z-30 border-t">
        <div className="mx-auto max-w-[480px] px-4 py-2">
          <Button
            variant="primary"
            block
            disabled={starting || !locationId}
            onClick={start}
          >
            {starting ? "Starting…" : "Start session"}
          </Button>
        </div>
      </div>

      <ExercisePicker
        open={picking !== null}
        title={picking?.kind === "swap" ? "Swap exercise" : "Add exercise"}
        onClose={() => setPicking(null)}
        onPick={pick}
        exercises={catalog.exercises}
        availableIds={available}
        candidateIds={swapCandidates}
        currentId={swapItem?.exerciseId ?? null}
      />
    </div>
  );
}

function dayOptions(catalog: Catalog) {
  const active = catalog.settings.activeProgramId;
  const ordered = [
    ...catalog.programs.filter((program) => program.id === active),
    ...catalog.programs.filter((program) => program.id !== active),
  ];
  const options = ordered.flatMap((program) =>
    program.days.map((day) => ({
      value: dayChoice(program.id, day.id),
      label:
        program.id === active
          ? `${day.name}${catalog.nextDayByProgram[program.id] === day.id ? " (up next)" : ""}`
          : `${program.name}: ${day.name}`,
    })),
  );
  return [...options, { value: FREESTYLE, label: "Freestyle (no program)" }];
}

function PreviewRow({
  item,
  catalog,
  onSwap,
  onRemove,
  onSets,
}: {
  item: PreviewItem;
  catalog: Catalog;
  onSwap: () => void;
  onRemove: () => void;
  onSets: (sets: number) => void;
}) {
  const exercise = findExercise(catalog, item.exerciseId);
  const last = item.exerciseId
    ? formatLast(catalog.lastSets[item.exerciseId])
    : "";
  const target = formatTarget(item.target, item.sets);
  const detail = exercise
    ? [target, last].filter(Boolean).join(" · ")
    : item.status === "unavailable"
      ? "Not available here. Choose a substitute."
      : `${item.label ?? "This"} has nothing available here.`;
  const title = exercise
    ? exercise.name
    : item.status === "unavailable"
      ? (item.label ?? "Not available here")
      : "Choose an exercise";

  return (
    <li className="border-hairline border-b py-2">
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={onSwap}
          className="flex min-h-12 min-w-0 flex-1 flex-col justify-center text-left"
        >
          <span
            className={`text-lead font-medium ${
              exercise ? "text-steel" : "text-rubber"
            }`}
          >
            {title}
          </span>
          <span
            className={`text-meta ${
              exercise ? "text-rubber" : "text-steel font-medium"
            }`}
          >
            {detail}
          </span>
        </button>
        <div
          role="group"
          aria-label="Sets"
          className="flex shrink-0 items-center"
        >
          <IconButton
            label="Fewer sets"
            icon={<MinusIcon size={20} />}
            disabled={item.sets <= 1}
            onClick={() => onSets(item.sets - 1)}
          />
          <span
            aria-live="polite"
            className="font-display text-title text-steel w-6 text-center font-semibold tabular-nums"
          >
            {item.sets}
          </span>
          <IconButton
            label="More sets"
            icon={<PlusIcon size={20} />}
            disabled={item.sets >= MAX_SETS}
            onClick={() => onSets(item.sets + 1)}
          />
        </div>
      </div>
      <div className="flex gap-1">
        <button
          type="button"
          onClick={onSwap}
          className="text-body text-plate-blue min-h-11 pr-3 font-medium"
        >
          {exercise ? "Swap" : "Choose"}
        </button>
        <button
          type="button"
          onClick={onRemove}
          className="text-body text-rubber min-h-11 px-3 font-medium"
        >
          Remove
        </button>
      </div>
    </li>
  );
}
