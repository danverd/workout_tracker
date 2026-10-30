import { randomUUID } from "node:crypto";
import { asc, eq, inArray, sql } from "drizzle-orm";
import type { Database } from "@/db/client";
import * as s from "@/db/schema";
import type { ProgramSaveInput } from "@/lib/validation/programs";
import type {
  ExerciseDto,
  MovementDto,
  ProgramDayDto,
  ProgramDto,
  ProgramSlotDto,
} from "@/types/domain";

/** Thrown for a bad reference or state; routes map it to a 4xx status. */
export class ProgramError extends Error {
  constructor(
    message: string,
    readonly status: 400 | 404 | 409,
  ) {
    super(message);
    this.name = "ProgramError";
  }
}

export interface ProgramSummaryDto {
  id: string;
  name: string;
  archived: boolean;
  active: boolean;
  dayNames: string[];
  slotCount: number;
}

type Executor = Pick<Database, "select" | "insert" | "update" | "delete">;

function toSlotDto(row: typeof s.programSlots.$inferSelect): ProgramSlotDto {
  return {
    id: row.id,
    position: row.position,
    movementId: row.movementId,
    exerciseId: row.exerciseId,
    sets: row.targetSets,
    repMin: row.repMin,
    repMax: row.repMax,
    amrap: row.amrap,
    notes: row.notes,
  };
}

async function loadProgram(
  db: Executor,
  id: string,
): Promise<ProgramDto | null> {
  const [program] = await db
    .select()
    .from(s.programs)
    .where(eq(s.programs.id, id));
  if (!program) return null;
  const days = await db
    .select()
    .from(s.programDays)
    .where(eq(s.programDays.programId, id))
    .orderBy(asc(s.programDays.position));
  const slots = days.length
    ? await db
        .select()
        .from(s.programSlots)
        .where(
          inArray(
            s.programSlots.dayId,
            days.map((d) => d.id),
          ),
        )
        .orderBy(asc(s.programSlots.position))
    : [];
  return {
    id: program.id,
    name: program.name,
    archived: program.archivedAt !== null,
    days: days.map((day): ProgramDayDto => ({
      id: day.id,
      name: day.name,
      position: day.position,
      slots: slots.filter((x) => x.dayId === day.id).map(toSlotDto),
    })),
  };
}

export function getProgram(db: Database, id: string) {
  return loadProgram(db, id);
}

export async function getActiveProgramId(db: Database) {
  const [row] = await db
    .select({ id: s.settings.activeProgramId })
    .from(s.settings)
    .where(eq(s.settings.id, 1));
  return row?.id ?? null;
}

export async function listPrograms(
  db: Database,
  { includeArchived = false } = {},
): Promise<ProgramSummaryDto[]> {
  const [programs, days, slotCounts, activeId] = await Promise.all([
    db.select().from(s.programs).orderBy(asc(s.programs.createdAt)),
    db.select().from(s.programDays).orderBy(asc(s.programDays.position)),
    db
      .select({ programId: s.programDays.programId, n: sql<number>`count(*)` })
      .from(s.programSlots)
      .innerJoin(s.programDays, eq(s.programSlots.dayId, s.programDays.id))
      .groupBy(s.programDays.programId),
    getActiveProgramId(db),
  ]);
  return programs
    .filter((p) => includeArchived || p.archivedAt === null)
    .map((p) => ({
      id: p.id,
      name: p.name,
      archived: p.archivedAt !== null,
      active: p.id === activeId,
      dayNames: days.filter((d) => d.programId === p.id).map((d) => d.name),
      slotCount: Number(slotCounts.find((c) => c.programId === p.id)?.n ?? 0),
    }))
    .sort((a, b) => Number(b.active) - Number(a.active));
}

export async function countArchivedPrograms(db: Database) {
  const rows = await db
    .select({ archivedAt: s.programs.archivedAt })
    .from(s.programs);
  return rows.filter((r) => r.archivedAt !== null).length;
}

/** Movements and live exercises offered by the slot picker. */
export async function getPickerOptions(db: Database): Promise<{
  movements: MovementDto[];
  exercises: Pick<ExerciseDto, "id" | "name" | "movementId">[];
}> {
  const [movements, exercises] = await Promise.all([
    db
      .select({ id: s.movements.id, name: s.movements.name })
      .from(s.movements)
      .orderBy(asc(s.movements.name)),
    db
      .select({
        id: s.exercises.id,
        name: s.exercises.name,
        movementId: s.exercises.movementId,
        archivedAt: s.exercises.archivedAt,
      })
      .from(s.exercises)
      .orderBy(asc(s.exercises.name)),
  ]);
  return {
    movements,
    exercises: exercises
      .filter((e) => e.archivedAt === null)
      .map(({ id, name, movementId }) => ({ id, name, movementId })),
  };
}

async function assertReferences(db: Executor, input: ProgramSaveInput) {
  const slots = input.days.flatMap((d) => d.slots);
  const movementIds = [
    ...new Set(slots.flatMap((x) => (x.movementId ? [x.movementId] : []))),
  ];
  const exerciseIds = [
    ...new Set(slots.flatMap((x) => (x.exerciseId ? [x.exerciseId] : []))),
  ];
  if (movementIds.length) {
    const found = await db
      .select({ id: s.movements.id })
      .from(s.movements)
      .where(inArray(s.movements.id, movementIds));
    if (found.length !== movementIds.length)
      throw new ProgramError(
        "A movement in this program no longer exists.",
        400,
      );
  }
  if (exerciseIds.length) {
    const found = await db
      .select({ id: s.exercises.id })
      .from(s.exercises)
      .where(inArray(s.exercises.id, exerciseIds));
    if (found.length !== exerciseIds.length)
      throw new ProgramError(
        "An exercise in this program no longer exists.",
        400,
      );
  }
}

/**
 * Replaces days and slots in place. Rows whose id already belongs to this
 * program are updated (so session history keeps its slot links); unknown ids
 * are inserted with the client id; rows no longer present are deleted.
 */
async function writeProgramBody(
  tx: Executor,
  programId: string,
  input: ProgramSaveInput,
) {
  const existingDays = await tx
    .select({ id: s.programDays.id })
    .from(s.programDays)
    .where(eq(s.programDays.programId, programId));
  const existingDayIds = new Set(existingDays.map((d) => d.id));
  const existingSlots = existingDays.length
    ? await tx
        .select({ id: s.programSlots.id })
        .from(s.programSlots)
        .where(
          inArray(
            s.programSlots.dayId,
            existingDays.map((d) => d.id),
          ),
        )
    : [];
  const existingSlotIds = new Set(existingSlots.map((x) => x.id));

  // Resolve final ids; a repeated or missing id gets a fresh one.
  const claimedDays = new Set<string>();
  const claimedSlots = new Set<string>();
  const claim = (claimed: Set<string>, id?: string) => {
    const final = id && !claimed.has(id) ? id : randomUUID();
    claimed.add(final);
    return final;
  };
  const days = input.days.map((day) => ({
    day,
    id: claim(claimedDays, day.id),
    slots: day.slots.map((slot) => ({
      slot,
      id: claim(claimedSlots, slot.id),
    })),
  }));

  // Delete removed slots first.
  const staleSlots = [...existingSlotIds].filter((id) => !claimedSlots.has(id));
  if (staleSlots.length)
    await tx
      .delete(s.programSlots)
      .where(inArray(s.programSlots.id, staleSlots));

  for (const [dayIndex, { day, id, slots }] of days.entries()) {
    if (existingDayIds.has(id)) {
      await tx
        .update(s.programDays)
        .set({ name: day.name, position: dayIndex })
        .where(eq(s.programDays.id, id));
    } else {
      await tx
        .insert(s.programDays)
        .values({ id, programId, name: day.name, position: dayIndex });
    }
    for (const [slotIndex, { slot, id: slotId }] of slots.entries()) {
      const values = {
        dayId: id,
        position: slotIndex,
        movementId: slot.movementId,
        exerciseId: slot.exerciseId,
        targetSets: slot.targetSets,
        repMin: slot.amrap ? null : slot.repMin,
        repMax: slot.amrap ? null : slot.repMax,
        amrap: slot.amrap,
        notes: slot.notes,
      };
      if (existingSlotIds.has(slotId)) {
        await tx
          .update(s.programSlots)
          .set(values)
          .where(eq(s.programSlots.id, slotId));
      } else {
        await tx.insert(s.programSlots).values({ id: slotId, ...values });
      }
    }
  }

  // Only now: slots moved out of a removed day have already been re-homed.
  const staleDays = [...existingDayIds].filter((id) => !claimedDays.has(id));
  if (staleDays.length)
    await tx.delete(s.programDays).where(inArray(s.programDays.id, staleDays));
}

export async function createProgram(
  db: Database,
  input: ProgramSaveInput,
): Promise<ProgramDto> {
  await assertReferences(db, input);
  const id = randomUUID();
  await db.transaction(async (tx) => {
    await tx.insert(s.programs).values({ id, name: input.name });
    await writeProgramBody(tx, id, input);
  });
  return (await loadProgram(db, id))!;
}

/** Whole-program replace in one transaction. Returns null if not found. */
export async function saveProgram(
  db: Database,
  id: string,
  input: ProgramSaveInput,
): Promise<ProgramDto | null> {
  const existing = await loadProgram(db, id);
  if (!existing) return null;
  await assertReferences(db, input);
  await db.transaction(async (tx) => {
    await tx
      .update(s.programs)
      .set({ name: input.name })
      .where(eq(s.programs.id, id));
    await writeProgramBody(tx, id, input);
  });
  return loadProgram(db, id);
}

export async function setActiveProgram(db: Database, id: string) {
  const program = await loadProgram(db, id);
  if (!program) throw new ProgramError("Program not found.", 404);
  if (program.archived)
    throw new ProgramError(
      "Restore this program before making it active.",
      409,
    );
  await db
    .insert(s.settings)
    .values({ id: 1, activeProgramId: id })
    .onConflictDoUpdate({
      target: s.settings.id,
      set: { activeProgramId: id },
    });
  return program;
}

/** Archiving the active program also clears it as the active one. */
export async function setProgramArchived(
  db: Database,
  id: string,
  archived: boolean,
): Promise<ProgramDto | null> {
  const [row] = await db
    .update(s.programs)
    .set({ archivedAt: archived ? new Date() : null })
    .where(eq(s.programs.id, id))
    .returning({ id: s.programs.id });
  if (!row) return null;
  if (archived) {
    await db
      .update(s.settings)
      .set({ activeProgramId: null })
      .where(eq(s.settings.activeProgramId, id));
  }
  return loadProgram(db, id);
}
