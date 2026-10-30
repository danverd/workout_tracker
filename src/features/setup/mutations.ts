import { and, eq, inArray, ne, sql } from "drizzle-orm";
import type { PgTable } from "drizzle-orm/pg-core";
import type { AnyPgColumn } from "drizzle-orm/pg-core";
import type { Database } from "@/db/client";
import {
  getExercise,
  getLocation,
  getSettings,
  listEquipment,
  listMovements,
  type EquipmentRow,
  type ExerciseRow,
  type LocationRow,
  type MovementRow,
} from "@/db/queries/setup";
import * as s from "@/db/schema";
import type {
  EquipmentInput,
  ExerciseInput,
  LocationInput,
  MovementInput,
  SettingsInput,
} from "@/lib/validation/setup";
import { HttpError } from "@/lib/http";
import type { SettingsDto } from "@/types/domain";

function pgCode(error: unknown): string | undefined {
  let current: unknown = error;
  for (let depth = 0; depth < 4 && current; depth++) {
    const code = (current as { code?: unknown }).code;
    if (typeof code === "string") return code;
    current = (current as { cause?: unknown }).cause;
  }
  return undefined;
}

/** Maps unique (23505) and foreign-key (23503) violations to friendly HttpErrors. */
function constraintFailure(error: unknown, noun: string): never {
  const code = pgCode(error);
  if (code === "23505")
    throw new HttpError(409, `A ${noun} with that name exists.`);
  if (code === "23503")
    throw new HttpError(400, "Something you picked no longer exists.");
  throw error;
}

async function nameTaken(
  db: Database,
  table: PgTable,
  nameColumn: AnyPgColumn,
  idColumn: AnyPgColumn,
  name: string,
  exceptId?: string,
) {
  const rows = await db
    .select({ id: idColumn })
    .from(table)
    .where(
      and(
        sql`lower(${nameColumn}) = lower(${name})`,
        exceptId ? ne(idColumn, exceptId) : undefined,
      ),
    )
    .limit(1);
  return rows.length > 0;
}

// ---- Equipment --------------------------------------------------------------

export async function createEquipment(
  db: Database,
  input: EquipmentInput,
): Promise<EquipmentRow> {
  if (
    await nameTaken(
      db,
      s.equipment,
      s.equipment.name,
      s.equipment.id,
      input.name,
    )
  )
    throw new HttpError(409, `You already have equipment named ${input.name}.`);
  try {
    const [row] = await db.insert(s.equipment).values(input).returning();
    return (await listEquipment(db, row.id))[0];
  } catch (error) {
    return constraintFailure(error, "equipment");
  }
}

export async function updateEquipment(
  db: Database,
  id: string,
  input: EquipmentInput,
): Promise<EquipmentRow> {
  if (
    await nameTaken(
      db,
      s.equipment,
      s.equipment.name,
      s.equipment.id,
      input.name,
      id,
    )
  )
    throw new HttpError(409, `You already have equipment named ${input.name}.`);
  try {
    const rows = await db
      .update(s.equipment)
      .set(input)
      .where(eq(s.equipment.id, id))
      .returning({ id: s.equipment.id });
    if (rows.length === 0) throw new HttpError(404, "Equipment not found.");
    return (await listEquipment(db, id))[0];
  } catch (error) {
    return constraintFailure(error, "equipment");
  }
}

export async function deleteEquipment(
  db: Database,
  id: string,
): Promise<{ id: string }> {
  const row = (await listEquipment(db, id))[0];
  if (!row) throw new HttpError(404, "Equipment not found.");
  if (row.usage)
    throw new HttpError(
      409,
      `${row.name} is used by ${row.usage}. Remove it there first.`,
    );
  await db.delete(s.equipment).where(eq(s.equipment.id, id));
  return { id };
}

// ---- Movements --------------------------------------------------------------

export async function createMovement(
  db: Database,
  input: MovementInput,
): Promise<MovementRow> {
  if (
    await nameTaken(
      db,
      s.movements,
      s.movements.name,
      s.movements.id,
      input.name,
    )
  )
    throw new HttpError(
      409,
      `You already have a movement named ${input.name}.`,
    );
  try {
    const [row] = await db.insert(s.movements).values(input).returning();
    return (await listMovements(db, row.id))[0];
  } catch (error) {
    return constraintFailure(error, "movement");
  }
}

export async function updateMovement(
  db: Database,
  id: string,
  input: MovementInput,
): Promise<MovementRow> {
  if (
    await nameTaken(
      db,
      s.movements,
      s.movements.name,
      s.movements.id,
      input.name,
      id,
    )
  )
    throw new HttpError(
      409,
      `You already have a movement named ${input.name}.`,
    );
  try {
    const rows = await db
      .update(s.movements)
      .set(input)
      .where(eq(s.movements.id, id))
      .returning({ id: s.movements.id });
    if (rows.length === 0) throw new HttpError(404, "Movement not found.");
    return (await listMovements(db, id))[0];
  } catch (error) {
    return constraintFailure(error, "movement");
  }
}

export async function deleteMovement(
  db: Database,
  id: string,
): Promise<{ id: string }> {
  const row = (await listMovements(db, id))[0];
  if (!row) throw new HttpError(404, "Movement not found.");
  if (row.usage)
    throw new HttpError(
      409,
      `${row.name} is used by ${row.usage}. Move them to another movement first.`,
    );
  await db.delete(s.movements).where(eq(s.movements.id, id));
  return { id };
}

// ---- Locations --------------------------------------------------------------

/** Ascending, de-duplicated; an empty list means "no list" (null). */
export function normalizeWeights(weights: number[] | null): number[] | null {
  if (!weights) return null;
  const unique = [...new Set(weights)].sort((a, b) => a - b);
  return unique.length > 0 ? unique : null;
}

/** Validated link rows (without the location id), or null for unknown equipment. */
async function locationEquipmentRows(
  db: Database,
  input: LocationInput,
): Promise<{ equipmentId: string; weights: number[] | null }[] | null> {
  const ids = input.equipment.map((item) => item.equipmentId);
  if (ids.length === 0) return [];
  const known = await db
    .select({ id: s.equipment.id, hasWeights: s.equipment.hasWeights })
    .from(s.equipment)
    .where(inArray(s.equipment.id, ids));
  if (known.length !== ids.length) return null;
  const weighted = new Set(known.filter((e) => e.hasWeights).map((e) => e.id));
  return input.equipment.map((item) => ({
    equipmentId: item.equipmentId,
    weights: weighted.has(item.equipmentId)
      ? normalizeWeights(item.weights)
      : null,
  }));
}

export async function createLocation(
  db: Database,
  input: LocationInput,
): Promise<LocationRow> {
  if (
    await nameTaken(
      db,
      s.locations,
      s.locations.name,
      s.locations.id,
      input.name,
    )
  )
    throw new HttpError(
      409,
      `You already have a location named ${input.name}.`,
    );
  const links = await locationEquipmentRows(db, input);
  if (!links)
    throw new HttpError(400, "Something you picked no longer exists.");
  try {
    const id = await db.transaction(async (tx) => {
      const [row] = await tx
        .insert(s.locations)
        .values({ name: input.name })
        .returning({ id: s.locations.id });
      if (links.length)
        await tx
          .insert(s.locationEquipment)
          .values(links.map((link) => ({ ...link, locationId: row.id })));
      return row.id;
    });
    return (await getLocation(db, id))!;
  } catch (error) {
    return constraintFailure(error, "location");
  }
}

export async function updateLocation(
  db: Database,
  id: string,
  input: LocationInput,
): Promise<LocationRow> {
  if (
    await nameTaken(
      db,
      s.locations,
      s.locations.name,
      s.locations.id,
      input.name,
      id,
    )
  )
    throw new HttpError(
      409,
      `You already have a location named ${input.name}.`,
    );
  const links = await locationEquipmentRows(db, input);
  if (!links)
    throw new HttpError(400, "Something you picked no longer exists.");
  try {
    const found = await db.transaction(async (tx) => {
      const rows = await tx
        .update(s.locations)
        .set({ name: input.name })
        .where(eq(s.locations.id, id))
        .returning({ id: s.locations.id });
      if (rows.length === 0) return false;
      await tx
        .delete(s.locationEquipment)
        .where(eq(s.locationEquipment.locationId, id));
      if (links.length)
        await tx
          .insert(s.locationEquipment)
          .values(links.map((link) => ({ ...link, locationId: id })));
      return true;
    });
    if (!found) throw new HttpError(404, "Location not found.");
    return (await getLocation(db, id))!;
  } catch (error) {
    return constraintFailure(error, "location");
  }
}

export async function setLocationArchived(
  db: Database,
  id: string,
  archived: boolean,
): Promise<LocationRow> {
  const rows = await db
    .update(s.locations)
    .set({ archivedAt: archived ? new Date() : null })
    .where(eq(s.locations.id, id))
    .returning({ id: s.locations.id });
  if (rows.length === 0) throw new HttpError(404, "Location not found.");
  return (await getLocation(db, id))!;
}

export async function deleteLocation(
  db: Database,
  id: string,
): Promise<{ id: string }> {
  const row = await getLocation(db, id);
  if (!row) throw new HttpError(404, "Location not found.");
  if (row.sessionCount > 0)
    throw new HttpError(
      409,
      `${row.name} has logged workouts, so it can't be deleted. Archive it instead.`,
    );
  await db.delete(s.locations).where(eq(s.locations.id, id));
  return { id };
}

// ---- Exercises --------------------------------------------------------------

async function validateExerciseRefs(db: Database, input: ExerciseInput) {
  if (input.movementId) {
    const rows = await db
      .select({ id: s.movements.id })
      .from(s.movements)
      .where(eq(s.movements.id, input.movementId));
    if (rows.length === 0) return false;
  }
  if (input.equipmentIds.length) {
    const rows = await db
      .select({ id: s.equipment.id })
      .from(s.equipment)
      .where(inArray(s.equipment.id, input.equipmentIds));
    if (rows.length !== input.equipmentIds.length) return false;
  }
  return true;
}

export async function createExercise(
  db: Database,
  input: ExerciseInput,
): Promise<ExerciseRow> {
  if (
    await nameTaken(
      db,
      s.exercises,
      s.exercises.name,
      s.exercises.id,
      input.name,
    )
  )
    throw new HttpError(
      409,
      `You already have an exercise named ${input.name}.`,
    );
  if (!(await validateExerciseRefs(db, input)))
    throw new HttpError(400, "Something you picked no longer exists.");
  try {
    const { equipmentIds, ...fields } = input;
    const id = await db.transaction(async (tx) => {
      const [row] = await tx
        .insert(s.exercises)
        .values(fields)
        .returning({ id: s.exercises.id });
      if (equipmentIds.length)
        await tx.insert(s.exerciseEquipment).values(
          equipmentIds.map((equipmentId) => ({
            exerciseId: row.id,
            equipmentId,
          })),
        );
      return row.id;
    });
    return (await getExercise(db, id))!;
  } catch (error) {
    return constraintFailure(error, "exercise");
  }
}

export async function updateExercise(
  db: Database,
  id: string,
  input: ExerciseInput,
): Promise<ExerciseRow> {
  if (
    await nameTaken(
      db,
      s.exercises,
      s.exercises.name,
      s.exercises.id,
      input.name,
      id,
    )
  )
    throw new HttpError(
      409,
      `You already have an exercise named ${input.name}.`,
    );
  if (!(await validateExerciseRefs(db, input)))
    throw new HttpError(400, "Something you picked no longer exists.");
  try {
    const { equipmentIds, ...fields } = input;
    const found = await db.transaction(async (tx) => {
      const rows = await tx
        .update(s.exercises)
        .set(fields)
        .where(eq(s.exercises.id, id))
        .returning({ id: s.exercises.id });
      if (rows.length === 0) return false;
      await tx
        .delete(s.exerciseEquipment)
        .where(eq(s.exerciseEquipment.exerciseId, id));
      if (equipmentIds.length)
        await tx.insert(s.exerciseEquipment).values(
          equipmentIds.map((equipmentId) => ({
            exerciseId: id,
            equipmentId,
          })),
        );
      return true;
    });
    if (!found) throw new HttpError(404, "Exercise not found.");
    return (await getExercise(db, id))!;
  } catch (error) {
    return constraintFailure(error, "exercise");
  }
}

export async function setExerciseArchived(
  db: Database,
  id: string,
  archived: boolean,
): Promise<ExerciseRow> {
  const rows = await db
    .update(s.exercises)
    .set({ archivedAt: archived ? new Date() : null })
    .where(eq(s.exercises.id, id))
    .returning({ id: s.exercises.id });
  if (rows.length === 0) throw new HttpError(404, "Exercise not found.");
  return (await getExercise(db, id))!;
}

export async function deleteExercise(
  db: Database,
  id: string,
): Promise<{ id: string }> {
  const row = await getExercise(db, id);
  if (!row) throw new HttpError(404, "Exercise not found.");
  if (row.usage)
    throw new HttpError(
      409,
      `${row.name} is used in ${row.usage}, so it can't be deleted. Archive it instead.`,
    );
  await db.delete(s.exercises).where(eq(s.exercises.id, id));
  return { id };
}

// ---- Settings ---------------------------------------------------------------

export async function updateSettings(
  db: Database,
  input: SettingsInput,
): Promise<SettingsDto> {
  try {
    await db
      .insert(s.settings)
      .values({ id: 1, ...input })
      .onConflictDoUpdate({ target: s.settings.id, set: input });
  } catch (error) {
    return constraintFailure(error, "setting");
  }
  return await getSettings(db);
}
