import { resolveSlots, type SlotStatus } from "@/lib/domain/resolve-slots";
import { suggestSets } from "@/lib/domain/suggestions";
import type { SessionCreateInput } from "@/lib/validation/sessions";
import type {
  ProgramDayDto,
  ProgramDto,
  SetSuggestion,
  SetTarget,
} from "@/types/domain";
import {
  findExercise,
  findLocation,
  locationEquipmentIds,
  newId,
  usageFor,
  weightListFor,
  type Catalog,
} from "./catalog";

/** One editable line of the start-session preview. */
export interface PreviewItem {
  /** Stable React key and the session-exercise id used on start. */
  key: string;
  slotId: string | null;
  /** The chosen exercise; null while the owner still has to choose. */
  exerciseId: string | null;
  status: SlotStatus | "added";
  /**
   * Context for a line with no exercise: the unavailable exercise's name, or
   * the movement nothing here matches.
   */
  label: string | null;
  /** Ranked alternatives available at the location for this line. */
  candidateIds: string[];
  target: SetTarget | null;
  sets: number;
}

export const DEFAULT_SET_COUNT = 3;
export const FREESTYLE = "freestyle";

/** Select value for a program day: "programId:dayId". */
export const dayChoice = (programId: string, dayId: string) =>
  `${programId}:${dayId}`;

export function parseDayChoice(
  catalog: Catalog,
  choice: string,
): { program: ProgramDto; day: ProgramDayDto } | null {
  const [programId, dayId] = choice.split(":");
  const program = catalog.programs.find((p) => p.id === programId);
  const day = program?.days.find((d) => d.id === dayId);
  return program && day ? { program, day } : null;
}

/** Location to preselect: last used, else the first one. */
export function defaultLocationId(catalog: Catalog): string | null {
  const last = findLocation(catalog, catalog.settings.lastLocationId);
  return last?.id ?? catalog.locations[0]?.id ?? null;
}

/** Day to preselect: the active program's next day, else freestyle. */
export function defaultDayChoice(catalog: Catalog): string {
  const active = catalog.programs.find(
    (program) => program.id === catalog.settings.activeProgramId,
  );
  const dayId = active ? catalog.nextDayByProgram[active.id] : null;
  return active && dayId ? dayChoice(active.id, dayId) : FREESTYLE;
}

/** Resolves a program day's slots for a location (design §6.3). */
export function buildPreviewItems(
  catalog: Catalog,
  locationId: string | null,
  day: ProgramDayDto | null,
): PreviewItem[] {
  if (!day) return [];
  const location = findLocation(catalog, locationId);
  const resolved = resolveSlots({
    slots: day.slots,
    exercises: catalog.exercises,
    locationEquipmentIds: locationEquipmentIds(location),
    usage: usageFor(catalog, locationId),
  });
  return day.slots.map((slot, index) => ({
    key: newId(),
    slotId: slot.id,
    exerciseId: resolved[index].exerciseId,
    status: resolved[index].status,
    label:
      resolved[index].status === "resolved"
        ? null
        : slot.exerciseId
          ? (findExercise(catalog, slot.exerciseId)?.name ?? "Exercise")
          : (catalog.movements.find((m) => m.id === slot.movementId)?.name ??
            null),
    candidateIds: resolved[index].candidateIds,
    target: {
      sets: slot.sets,
      repMin: slot.repMin,
      repMax: slot.repMax,
      amrap: slot.amrap,
    },
    sets: slot.sets,
  }));
}

/** Pre-filled weights for an exercise at a location (design §6.5). */
export function suggestionsFor(
  catalog: Catalog,
  locationId: string | null,
  exerciseId: string,
  targetSets: number,
): SetSuggestion[] {
  const exercise = findExercise(catalog, exerciseId);
  return suggestSets({
    targetSets,
    lastSets: catalog.lastSets[exerciseId] ?? [],
    weights: weightListFor(catalog, locationId, exercise),
  });
}

/** Payload for PUT /api/sessions/[id]; the server adds snapshots and date. */
export function buildCreateInput(input: {
  catalog: Catalog;
  sessionId: string;
  locationId: string | null;
  program: ProgramDto | null;
  day: ProgramDayDto | null;
  items: readonly PreviewItem[];
  startedAt?: string;
}): SessionCreateInput {
  const { catalog, locationId, program, day } = input;
  const chosen = input.items.filter((item) => item.exerciseId !== null);
  return {
    id: input.sessionId,
    locationId,
    programId: program?.id ?? null,
    programDayId: day?.id ?? null,
    title: program?.name ?? "Freestyle",
    dayName: day?.name ?? "",
    notes: "",
    startedAt: input.startedAt,
    exercises: chosen.map((item, position) => ({
      id: item.key,
      exerciseId: item.exerciseId as string,
      slotId: item.slotId,
      position,
      sets: suggestionsFor(
        catalog,
        locationId,
        item.exerciseId as string,
        item.sets,
      ).map((suggestion, index) => ({
        id: newId(),
        position: index,
        weight: suggestion.weight ?? 0,
        reps: null,
        done: false,
      })),
    })),
  };
}
