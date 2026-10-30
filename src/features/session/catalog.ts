import { plural } from "@/lib/format";
import { isAvailableAt, rankCandidates } from "@/lib/domain/resolve-slots";
import type {
  ExerciseDto,
  LastSetDto,
  LocationDto,
  SessionCatalog,
  SetTarget,
  UsageHistory,
} from "@/types/domain";

export type Catalog = SessionCatalog;

/** Client-safe uuid; `crypto.randomUUID` is missing on plain-http LAN pages. */
export function newId(): string {
  if (typeof crypto.randomUUID === "function") return crypto.randomUUID();
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0"));
  return [
    hex.slice(0, 4).join(""),
    hex.slice(4, 6).join(""),
    hex.slice(6, 8).join(""),
    hex.slice(8, 10).join(""),
    hex.slice(10).join(""),
  ].join("-");
}

export function findLocation(
  catalog: Catalog,
  locationId: string | null,
): LocationDto | null {
  return catalog.locations.find((l) => l.id === locationId) ?? null;
}

export function findExercise(
  catalog: Catalog,
  exerciseId: string | null,
): ExerciseDto | null {
  return catalog.exercises.find((e) => e.id === exerciseId) ?? null;
}

export function usageFor(
  catalog: Catalog,
  locationId: string | null,
): UsageHistory {
  return {
    lastUsedAnywhere: catalog.lastUsedAnywhere,
    lastUsedAtLocation: locationId
      ? (catalog.lastUsedByLocation[locationId] ?? {})
      : {},
  };
}

export function locationEquipmentIds(location: LocationDto | null): string[] {
  return location?.equipment.map((item) => item.equipmentId) ?? [];
}

/** Exercises usable at a location (all equipment present), alphabetical. */
export function availableExercises(
  catalog: Catalog,
  locationId: string | null,
): ExerciseDto[] {
  const here = new Set(locationEquipmentIds(findLocation(catalog, locationId)));
  return catalog.exercises
    .filter((exercise) => isAvailableAt(exercise, here))
    .sort((a, b) => a.name.localeCompare(b.name));
}

/** The location's weight list for the exercise's weighted equipment. */
export function weightListFor(
  catalog: Catalog,
  locationId: string | null,
  exercise: ExerciseDto | null,
): number[] | null {
  if (!exercise?.weightEquipmentId) return null;
  const weights = findLocation(catalog, locationId)?.equipment.find(
    (item) => item.equipmentId === exercise.weightEquipmentId,
  )?.weights;
  return weights && weights.length > 0 ? weights : null;
}

/** Same-movement alternatives available here, most relevant first. */
export function substitutesFor(
  catalog: Catalog,
  locationId: string | null,
  exercise: ExerciseDto | null,
): string[] {
  if (!exercise?.movementId) return [];
  return rankCandidates(
    availableExercises(catalog, locationId).filter(
      (candidate) => candidate.movementId === exercise.movementId,
    ),
    usageFor(catalog, locationId),
  ).map((candidate) => candidate.id);
}

// ---- Formatting -------------------------------------------------------------

/** "3 × 8–12", "3 × 10", "3 × AMRAP" or "3 sets". */
export function formatTarget(target: SetTarget | null, sets?: number): string {
  const count = sets ?? target?.sets;
  if (count === undefined) return "";
  if (!target) return plural(count, "set");
  if (target.amrap) return `${count} × AMRAP`;
  const { repMin, repMax } = target;
  if (repMin !== null && repMax !== null)
    return repMin === repMax
      ? `${count} × ${repMin}`
      : `${count} × ${repMin}–${repMax}`;
  const single = repMin ?? repMax;
  return single === null ? plural(count, "set") : `${count} × ${single}`;
}

/** "last: 50 × 10, 50 × 9" (up to three sets), or "" with no history. */
export function formatLast(lastSets: readonly LastSetDto[] | undefined) {
  if (!lastSets || lastSets.length === 0) return "";
  const parts = [...lastSets]
    .sort((a, b) => a.position - b.position)
    .slice(0, 3)
    .map((set) => `${set.weight} × ${set.reps ?? "–"}`);
  return `last: ${parts.join(", ")}${lastSets.length > 3 ? "…" : ""}`;
}

/** Rep count to fill when marking done without typing one. */
export function targetReps(target: SetTarget | null): number | null {
  return target?.repMin ?? target?.repMax ?? null;
}

/** Last time's reps for the set at `index`; extra sets repeat the last one. */
export function lastRepsAt(
  lastSets: readonly LastSetDto[] | undefined,
  index: number,
): number | null {
  if (!lastSets || lastSets.length === 0) return null;
  const sorted = [...lastSets].sort((a, b) => a.position - b.position);
  return (sorted[index] ?? sorted[sorted.length - 1]).reps;
}
