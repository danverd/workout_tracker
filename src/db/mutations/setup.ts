import { eq, inArray } from "drizzle-orm";
import type { Database } from "@/db/client";
import {
  getExercise,
  getLocation,
  getSettings,
  listEquipment,
  listMovements,
} from "@/db/queries/setup";
import { nameTaken, setArchived } from "@/db/mutations/shared";
import * as s from "@/db/schema";
import type {
  EquipmentInput,
  ExerciseInput,
  LocationInput,
  MovementInput,
  SettingsInput,
} from "@/lib/validation/setup";
import { HttpError } from "@/lib/http";
import type {
  EquipmentRow,
  ExerciseRow,
  LocationRow,
  MovementRow,
  SettingsDto,
} from "@/types/domain";

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

// ---- Equipment and movements ------------------------------------------------

interface NamedEntityConfig<
  Row extends { id: string; name: string; usage: string | null },
> {
  table: typeof s.equipment | typeof s.movements;
  list: (db: Database, onlyId?: string) => Promise<Row[]>;
  /** "equipment" / "movement"; used in error messages. */
  noun: string;
  /** "equipment" / "a movement"; completes "You already have ...". */
  alreadyHave: string;
  notFound: string;
  /** What to tell the owner to do before deleting an in-use row. */
  removeFirst: string;
}

/** Create / update / delete for the two name-keyed lists. */
function namedEntityOps<
  Input extends { name: string },
  Row extends { id: string; name: string; usage: string | null },
>(config: NamedEntityConfig<Row>) {
  // Both tables share id/name; one typed table stands in for the union.
  const table = config.table as typeof s.equipment;
  const taken = (input: Input) =>
    new HttpError(
      409,
      `You already have ${config.alreadyHave} named ${input.name}.`,
    );
  return {
    async create(db: Database, input: Input): Promise<Row> {
      if (await nameTaken(db, config.table, input.name)) throw taken(input);
      try {
        const [row] = await db
          .insert(table)
          .values(input as typeof table.$inferInsert)
          .returning();
        return (await config.list(db, row.id))[0];
      } catch (error) {
        return constraintFailure(error, config.noun);
      }
    },
    async update(db: Database, id: string, input: Input): Promise<Row> {
      if (await nameTaken(db, config.table, input.name, id)) throw taken(input);
      try {
        const rows = await db
          .update(table)
          .set(input as Partial<typeof table.$inferInsert>)
          .where(eq(table.id, id))
          .returning({ id: table.id });
        if (rows.length === 0) throw new HttpError(404, config.notFound);
        return (await config.list(db, id))[0];
      } catch (error) {
        return constraintFailure(error, config.noun);
      }
    },
    async remove(db: Database, id: string): Promise<{ id: string }> {
      const row = (await config.list(db, id))[0];
      if (!row) throw new HttpError(404, config.notFound);
      if (row.usage)
        throw new HttpError(
          409,
          `${row.name} is used by ${row.usage}. ${config.removeFirst}`,
        );
      await db.delete(table).where(eq(table.id, id));
      return { id };
    },
  };
}

const equipmentOps = namedEntityOps<EquipmentInput, EquipmentRow>({
  table: s.equipment,
  list: listEquipment,
  noun: "equipment",
  alreadyHave: "equipment",
  notFound: "Equipment not found.",
  removeFirst: "Remove it there first.",
});
const movementOps = namedEntityOps<MovementInput, MovementRow>({
  table: s.movements,
  list: listMovements,
  noun: "movement",
  alreadyHave: "a movement",
  notFound: "Movement not found.",
  removeFirst: "Move them to another movement first.",
});

export const createEquipment = equipmentOps.create;
export const updateEquipment = equipmentOps.update;
export const deleteEquipment = equipmentOps.remove;
export const createMovement = movementOps.create;
export const updateMovement = movementOps.update;
export const deleteMovement = movementOps.remove;

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
  if (await nameTaken(db, s.locations, input.name))
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
  if (await nameTaken(db, s.locations, input.name, id))
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
  if (!(await setArchived(db, s.locations, id, archived)))
    throw new HttpError(404, "Location not found.");
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
  if (await nameTaken(db, s.exercises, input.name))
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
  if (await nameTaken(db, s.exercises, input.name, id))
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
  if (!(await setArchived(db, s.exercises, id, archived)))
    throw new HttpError(404, "Exercise not found.");
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
