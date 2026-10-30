import { asc, count, eq, sql } from "drizzle-orm";
import type { AnyPgColumn, PgTable } from "drizzle-orm/pg-core";
import type { Database } from "@/db/client";
import * as s from "@/db/schema";
import { plural } from "@/lib/format";
import type {
  EquipmentRow,
  ExerciseDto,
  ExerciseRow,
  LoadType,
  LocationDto,
  LocationRow,
  MovementRow,
  SettingsDto,
} from "@/types/domain";

/** "2 locations and 1 exercise", or null when every count is zero. */
function describeUsage(
  parts: readonly [count: number, singular: string, plural: string][],
): string | null {
  const phrases = parts
    .filter(([n]) => n > 0)
    .map(([n, one, many]) => plural(n, one, many));
  if (phrases.length === 0) return null;
  return phrases.length === 1
    ? phrases[0]
    : `${phrases.slice(0, -1).join(", ")} and ${phrases[phrases.length - 1]}`;
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

/** A table whose rows reference an entity, counted per entity id. */
interface UsageSource {
  table: PgTable;
  column: AnyPgColumn;
  one: string;
  many: string;
}

/** Runs `rows` and one grouped count per source, then attaches the usage phrase. */
async function listWithUsage<T extends { id: string }, R>(
  db: Database,
  rows: Promise<T[]>,
  sources: readonly UsageSource[],
  toRow: (row: T, usage: string | null) => R,
): Promise<R[]> {
  const [list, ...counts] = await Promise.all([
    rows,
    ...sources.map((source) =>
      db
        .select({ id: source.column, n: count() })
        .from(source.table)
        .groupBy(source.column),
    ),
  ]);
  const maps = counts.map((rows) =>
    countMap(rows as { id: string | null; n: number }[]),
  );
  return list.map((row) =>
    toRow(
      row,
      describeUsage(
        sources.map((source, i) => [
          maps[i].get(row.id) ?? 0,
          source.one,
          source.many,
        ]),
      ),
    ),
  );
}

export function listEquipment(
  db: Database,
  onlyId?: string,
): Promise<EquipmentRow[]> {
  return listWithUsage(
    db,
    db
      .select()
      .from(s.equipment)
      .where(onlyId ? eq(s.equipment.id, onlyId) : undefined)
      .orderBy(lowerName(s.equipment.name)),
    [
      {
        table: s.locationEquipment,
        column: s.locationEquipment.equipmentId,
        one: "location",
        many: "locations",
      },
      {
        table: s.exerciseEquipment,
        column: s.exerciseEquipment.equipmentId,
        one: "exercise",
        many: "exercises",
      },
    ],
    (row, usage) => ({
      id: row.id,
      name: row.name,
      hasWeights: row.hasWeights,
      usage,
    }),
  );
}

export function listMovements(
  db: Database,
  onlyId?: string,
): Promise<MovementRow[]> {
  return listWithUsage(
    db,
    db
      .select()
      .from(s.movements)
      .where(onlyId ? eq(s.movements.id, onlyId) : undefined)
      .orderBy(lowerName(s.movements.name)),
    [
      {
        table: s.exercises,
        column: s.exercises.movementId,
        one: "exercise",
        many: "exercises",
      },
      {
        table: s.programSlots,
        column: s.programSlots.movementId,
        one: "program slot",
        many: "program slots",
      },
    ],
    (row, usage) => ({ id: row.id, name: row.name, usage }),
  );
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
  const [links, rows] = await Promise.all([
    db
      .select()
      .from(s.exerciseEquipment)
      .where(onlyId ? eq(s.exerciseEquipment.exerciseId, onlyId) : undefined),
    listExerciseRows(db, onlyId),
  ]);
  return rows.map(({ row, usage }) => ({
    ...toExerciseDto(row, links),
    usage,
  }));
}

function listExerciseRows(db: Database, onlyId?: string) {
  return listWithUsage(
    db,
    db
      .select()
      .from(s.exercises)
      .where(onlyId ? eq(s.exercises.id, onlyId) : undefined)
      .orderBy(lowerName(s.exercises.name)),
    [
      {
        table: s.sessionExercises,
        column: s.sessionExercises.exerciseId,
        one: "logged workout",
        many: "logged workouts",
      },
      {
        table: s.programSlots,
        column: s.programSlots.exerciseId,
        one: "program slot",
        many: "program slots",
      },
    ],
    (row, usage) => ({ row, usage }),
  );
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
