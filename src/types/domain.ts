// Shared domain types. Dates are YYYY-MM-DD strings in the owner's time zone;
// timestamps are ISO-8601 strings. All weights are pounds.

export const LOAD_TYPES = [
  "total",
  "per_hand",
  "per_side",
  "assisted",
  "bodyweight",
] as const;
export type LoadType = (typeof LOAD_TYPES)[number];

export const SESSION_KINDS = ["strength", "cardio"] as const;
export type SessionKind = (typeof SESSION_KINDS)[number];

export const DISTANCE_UNITS = ["mi", "km"] as const;
export type DistanceUnit = (typeof DISTANCE_UNITS)[number];

/** Target of a program slot: sets plus a rep number, a range, or AMRAP. */
export interface SetTarget {
  sets: number;
  repMin: number | null;
  repMax: number | null;
  amrap: boolean;
}

// ---- Setup ----------------------------------------------------------------

export interface EquipmentDto {
  id: string;
  name: string;
  hasWeights: boolean;
}

export interface LocationEquipmentDto {
  equipmentId: string;
  /** Available weights at this location; null = not applicable or "any". */
  weights: number[] | null;
}

export interface LocationDto {
  id: string;
  name: string;
  archived: boolean;
  equipment: LocationEquipmentDto[];
}

export interface MovementDto {
  id: string;
  name: string;
}

export interface ExerciseDto {
  id: string;
  name: string;
  movementId: string | null;
  loadType: LoadType;
  baseWeight: number;
  /** Required equipment whose weight list drives snapping and stepper chips. */
  weightEquipmentId: string | null;
  increment: number;
  archived: boolean;
  /** All required equipment (every item must be present at the location). */
  equipmentIds: string[];
}

export interface SettingsDto {
  bodyweightLb: number;
  activeProgramId: string | null;
  lastLocationId: string | null;
}

// ---- Programs -------------------------------------------------------------

export interface ProgramSlotDto extends SetTarget {
  id: string;
  position: number;
  /** Exactly one of movementId / exerciseId is set. */
  movementId: string | null;
  exerciseId: string | null;
  notes: string;
}

export interface ProgramDayDto {
  id: string;
  name: string;
  position: number;
  slots: ProgramSlotDto[];
}

export interface ProgramDto {
  id: string;
  name: string;
  archived: boolean;
  days: ProgramDayDto[];
}

// ---- Sessions -------------------------------------------------------------

export interface SessionSetDto {
  id: string;
  sessionExerciseId: string;
  position: number;
  weight: number;
  reps: number | null;
  done: boolean;
  /** Server-computed; the client never sends it. */
  volume: number;
}

export interface SessionExerciseDto {
  id: string;
  sessionId: string;
  exerciseId: string | null;
  slotId: string | null;
  position: number;
  name: string;
  loadType: LoadType;
  baseWeight: number;
  sets: SessionSetDto[];
}

export interface CardioEntryDto {
  activity: string;
  durationSec: number | null;
  distance: number | null;
  distanceUnit: DistanceUnit | null;
}

export interface SessionDto {
  id: string;
  date: string;
  kind: SessionKind;
  locationId: string | null;
  programId: string | null;
  programDayId: string | null;
  title: string;
  dayName: string;
  bodyweightLb: number;
  notes: string;
  startedAt: string;
  finishedAt: string | null;
  exercises: SessionExerciseDto[];
  cardio: CardioEntryDto | null;
}

/** Response of a header patch / finish / reopen. */
export type SessionHeaderDto = Omit<SessionDto, "exercises" | "cardio">;

// ---- History --------------------------------------------------------------

export interface SessionSummaryDto {
  id: string;
  date: string;
  kind: SessionKind;
  title: string;
  dayName: string;
  locationId: string | null;
  locationName: string | null;
  startedAt: string;
  finishedAt: string | null;
  exerciseCount: number;
  doneSetCount: number;
  totalVolume: number;
  cardio: CardioEntryDto | null;
}

export interface ExerciseHistorySessionDto {
  sessionId: string;
  date: string;
  locationName: string | null;
  sets: Pick<SessionSetDto, "position" | "weight" | "reps" | "volume">[];
  totalVolume: number;
}

export interface ExerciseHistoryDto {
  exerciseId: string;
  name: string;
  loadType: LoadType;
  sessions: ExerciseHistorySessionDto[];
  /** Highest-volume done set, or null if none. */
  bestSet: {
    sessionId: string;
    date: string;
    weight: number;
    reps: number;
    volume: number;
  } | null;
}

export interface VolumePeriodDto {
  start: string;
  end: string;
  totalVolume: number;
  sessionCount: number;
}

export interface VolumeSummaryDto {
  period: "week" | "month";
  current: VolumePeriodDto;
  /** Most recent periods first, including the current one. */
  periods: VolumePeriodDto[];
}

// ---- Session start (preview) data ----------------------------------------

/** Last time an exercise was used, keyed by exercise id. ISO strings. */
export interface UsageHistory {
  lastUsedAtLocation: Record<string, string>;
  lastUsedAnywhere: Record<string, string>;
}

/** A done set from the most recent session containing the exercise. */
export interface LastSetDto {
  position: number;
  weight: number;
  reps: number | null;
}

export interface SetSuggestion {
  weight: number | null;
  /** Reps from the matching set last time, used to default reps on done. */
  lastReps: number | null;
}
