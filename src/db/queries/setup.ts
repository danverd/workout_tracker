import { asc, count, eq, sql } from "drizzle-orm";
import type { AnyPgColumn } from "drizzle-orm/pg-core";
import type { Database } from "@/db/client";
import * as s from "@/db/schema";
import type {
  EquipmentDto,
  ExerciseDto,
  LoadType,
  LocationDto,
  MovementDto,
  SettingsDto,
} from "@/types/domain";

/** "2 locations and 1 exercise", or null when every count is zero. */
export function describeUsage(
  parts: readonly [count: number, singular: string, plural: string][],
): string | null {
  const phrases = parts
    .filter(([n]) => n > 0)
    .map(([n, one, many]) => `${n} ${n === 1 ? one : many}`);
  if (phrases.length === 0) return null;
  return phrases.length === 1
    ? phrases[0]
    : `${phrases.slice(0, -1).join(", ")} and ${phrases[phrases.length - 1]}`;
}

export interface EquipmentRow extends EquipmentDto {
  /** Phrase naming what uses it ("2 locations"), or null when unused. */
  usage: string | null;
}
export interface MovementRow extends MovementDto {
  usage: string | null;
}
export interface LocationRow extends LocationDto {
  /** Logged sessions at this location; deletion is only allowed at zero. */
  sessionCount: number;
}
export interface ExerciseRow extends ExerciseDto {
  usage: string | null;
}

export interface SetupCounts {
  equipment: number;
  locations: number;
  movements: number;
  exercises: number;
}

const lowerName = (column: AnyPgColumn) => asc(sql`lower(${column})`);

function countMap(rows: { id: string | null; n: number }[]) {
  const map = new Map<string, number>();
  for (const row of rows) if (row.id) map.set(row.id, Number(row.n));
  return map;
}

export async function getSetupCounts(db: Database): Promise<SetupCounts> {
  const [[equipment], [locations], [movements], [exercises]] =
    await Promise.all([
      db.select({ n: count() }).from(s.equipment),
      db
        .select({ n: count() })
        .from(s.locations)
        .where(sql`${s.locations.archivedAt} is null`),
      db.select({ n: count() }).from(s.movements),
      db
        .select({ n: count() })
        .from(s.exercises)
        .where(sql`${s.exercises.archivedAt} is null`),
    ]);
  return {
    equipment: equipment.n,
    locations: locations.n,
    movements: movements.n,
    exercises: exercises.n,
  };
}

export async function listEquipment(
  db: Database,
  onlyId?: string,
): Promise<EquipmentRow[]> {
  const [rows, inLocations, inExercises] = await Promise.all([
    db
      .select()
      .from(s.equipment)
      .where(onlyId ? eq(s.equipment.id, onlyId) : undefined)
      .orderBy(lowerName(s.equipment.name)),
    db
      .select({ id: s.locationEquipment.equipmentId, n: count() })
      .from(s.locationEquipment)
      .groupBy(s.locationEquipment.equipmentId),
    db
      .select({ id: s.exerciseEquipment.equipmentId, n: count() })
      .from(s.exerciseEquipment)
      .groupBy(s.exerciseEquipment.equipmentId),
  ]);
  const locs = countMap(inLocations);
  const exs = countMap(inExercises);
  return rows.map((row) => ({
    id: row.id,
    name: row.name,
    hasWeights: row.hasWeights,
    usage: describeUsage([
      [locs.get(row.id) ?? 0, "location", "locations"],
      [exs.get(row.id) ?? 0, "exercise", "exercises"],
    ]),
  }));
}

export async function listMovements(
  db: Database,
  onlyId?: string,
): Promise<MovementRow[]> {
  const [rows, inExercises, inSlots] = await Promise.all([
    db
      .select()
      .from(s.movements)
      .where(onlyId ? eq(s.movements.id, onlyId) : undefined)
      .orderBy(lowerName(s.movements.name)),
    db
      .select({ id: s.exercises.movementId, n: count() })
      .from(s.exercises)
      .groupBy(s.exercises.movementId),
    db
      .select({ id: s.programSlots.movementId, n: count() })
      .from(s.programSlots)
      .groupBy(s.programSlots.movementId),
  ]);
  const exs = countMap(inExercises);
  const slots = countMap(inSlots);
  return rows.map((row) => ({
    id: row.id,
    name: row.name,
    usage: describeUsage([
      [exs.get(row.id) ?? 0, "exercise", "exercises"],
      [slots.get(row.id) ?? 0, "program slot", "program slots"],
    ]),
  }));
}

/** `links` may hold other locations' rows; only this location's are used. */
export function toLocationDto(
  row: typeof s.locations.$inferSelect,
  links: (typeof s.locationEquipment.$inferSelect)[],
): LocationDto {
  return {
    id: row.id,
    name: row.name,
    archived: row.archivedAt !== null,
    equipment: links
      .filter((link) => link.locationId === row.id)
      .map((link) => ({
        equipmentId: link.equipmentId,
        weights: link.weights,
      })),
  };
}

/** `links` may hold other exercises' rows; only this exercise's are used. */
export function toExerciseDto(
  row: typeof s.exercises.$inferSelect,
  links: (typeof s.exerciseEquipment.$inferSelect)[],
): ExerciseDto {
  return {
    id: row.id,
    name: row.name,
    movementId: row.movementId,
    loadType: row.loadType as LoadType,
    baseWeight: row.baseWeight,
    weightEquipmentId: row.weightEquipmentId,
    increment: row.increment,
    archived: row.archivedAt !== null,
    equipmentIds: links
      .filter((link) => link.exerciseId === row.id)
      .map((link) => link.equipmentId),
  };
}

export async function listLocations(
  db: Database,
  onlyId?: string,
): Promise<LocationRow[]> {
  const [rows, equipmentRows, sessionRows] = await Promise.all([
    db
      .select()
      .from(s.locations)
      .where(onlyId ? eq(s.locations.id, onlyId) : undefined)
      .orderBy(lowerName(s.locations.name)),
    db
      .select()
      .from(s.locationEquipment)
      .where(onlyId ? eq(s.locationEquipment.locationId, onlyId) : undefined),
    db
      .select({ id: s.sessions.locationId, n: count() })
      .from(s.sessions)
      .groupBy(s.sessions.locationId),
  ]);
  const sessionCounts = countMap(sessionRows);
  return rows.map((row) => ({
    ...toLocationDto(row, equipmentRows),
    sessionCount: sessionCounts.get(row.id) ?? 0,
  }));
}

export async function getLocation(db: Database, id: string) {
  return (await listLocations(db, id))[0] ?? null;
}

export async function listExercises(
  db: Database,
  onlyId?: string,
): Promise<ExerciseRow[]> {
  const [rows, links, inSessions, inSlots] = await Promise.all([
    db
      .select()
      .from(s.exercises)
      .where(onlyId ? eq(s.exercises.id, onlyId) : undefined)
      .orderBy(lowerName(s.exercises.name)),
    db
      .select()
      .from(s.exerciseEquipment)
      .where(onlyId ? eq(s.exerciseEquipment.exerciseId, onlyId) : undefined),
    db
      .select({ id: s.sessionExercises.exerciseId, n: count() })
      .from(s.sessionExercises)
      .groupBy(s.sessionExercises.exerciseId),
    db
      .select({ id: s.programSlots.exerciseId, n: count() })
      .from(s.programSlots)
      .groupBy(s.programSlots.exerciseId),
  ]);
  const sessions = countMap(inSessions);
  const slots = countMap(inSlots);
  return rows.map((row) => ({
    ...toExerciseDto(row, links),
    usage: describeUsage([
      [sessions.get(row.id) ?? 0, "logged workout", "logged workouts"],
      [slots.get(row.id) ?? 0, "program slot", "program slots"],
    ]),
  }));
}

export async function getExercise(db: Database, id: string) {
  return (await listExercises(db, id))[0] ?? null;
}

export async function getSettings(db: Database): Promise<SettingsDto> {
  await db.insert(s.settings).values({ id: 1 }).onConflictDoNothing();
  const [row] = await db.select().from(s.settings).where(eq(s.settings.id, 1));
  return {
    bodyweightLb: row.bodyweightLb,
    activeProgramId: row.activeProgramId,
    lastLocationId: row.lastLocationId,
  };
}
