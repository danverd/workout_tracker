import { and, asc, desc, eq, inArray, isNotNull, ne, sql } from "drizzle-orm";
import type { Database } from "@/db/client";
import * as s from "@/db/schema";
import { todayInAppTimeZone } from "@/lib/dates";
import { nextProgramDay } from "@/lib/domain/rotation";
import { setVolume } from "@/lib/domain/volume";
import type {
  SessionCreateInput,
  SessionExerciseInput,
  SessionPatchInput,
  SessionSetInput,
} from "@/lib/validation/sessions";
import type {
  ExerciseDto,
  LastSetDto,
  LoadType,
  LocationDto,
  MovementDto,
  ProgramDto,
  SessionDto,
  SessionExerciseDto,
  SessionHeaderDto,
  SessionSetDto,
  SetTarget,
  SettingsDto,
} from "@/types/domain";

/** Error with an HTTP status, mapped to a JSON response by the routes. */
export class SessionQueryError extends Error {
  readonly status: number;
  constructor(status: number, message: string) {
    super(message);
    this.name = "SessionQueryError";
    this.status = status;
  }
}

type Tx = Parameters<Parameters<Database["transaction"]>[0]>[0];
type Executor = Database | Tx;

const iso = (value: Date) => value.toISOString();

// ---- Mappers ---------------------------------------------------------------

function headerFrom(row: typeof s.sessions.$inferSelect): SessionHeaderDto {
  return {
    id: row.id,
    date: row.date,
    kind: row.kind as SessionHeaderDto["kind"],
    locationId: row.locationId,
    programId: row.programId,
    programDayId: row.programDayId,
    title: row.title,
    dayName: row.dayName,
    bodyweightLb: row.bodyweightLb,
    notes: row.notes,
    startedAt: iso(row.startedAt),
    finishedAt: row.finishedAt ? iso(row.finishedAt) : null,
  };
}

function setFrom(row: typeof s.sessionSets.$inferSelect): SessionSetDto {
  return {
    id: row.id,
    sessionExerciseId: row.sessionExerciseId,
    position: row.position,
    weight: row.weight,
    reps: row.reps,
    done: row.done,
    volume: row.volume,
  };
}

function exerciseFrom(
  row: typeof s.sessionExercises.$inferSelect,
  sets: SessionSetDto[],
): SessionExerciseDto {
  return {
    id: row.id,
    sessionId: row.sessionId,
    exerciseId: row.exerciseId,
    slotId: row.slotId,
    position: row.position,
    name: row.name,
    loadType: row.loadType as LoadType,
    baseWeight: row.baseWeight,
    sets,
  };
}

// ---- Reading a session ------------------------------------------------------

async function sessionRow(db: Executor, id: string) {
  const [row] = await db.select().from(s.sessions).where(eq(s.sessions.id, id));
  return row ?? null;
}

export async function getSession(
  db: Executor,
  id: string,
): Promise<SessionDto | null> {
  const row = await sessionRow(db, id);
  if (!row) return null;
  const [exerciseRows, cardioRows] = await Promise.all([
    db
      .select()
      .from(s.sessionExercises)
      .where(eq(s.sessionExercises.sessionId, id))
      .orderBy(asc(s.sessionExercises.position)),
    db.select().from(s.cardioEntries).where(eq(s.cardioEntries.sessionId, id)),
  ]);
  const setRows = exerciseRows.length
    ? await db
        .select()
        .from(s.sessionSets)
        .where(
          inArray(
            s.sessionSets.sessionExerciseId,
            exerciseRows.map((exercise) => exercise.id),
          ),
        )
        .orderBy(asc(s.sessionSets.position))
    : [];
  const cardio = cardioRows[0];
  return {
    ...headerFrom(row),
    exercises: exerciseRows.map((exercise) =>
      exerciseFrom(
        exercise,
        setRows
          .filter((set) => set.sessionExerciseId === exercise.id)
          .map(setFrom),
      ),
    ),
    cardio: cardio
      ? {
          activity: cardio.activity,
          durationSec: cardio.durationSec,
          distance: cardio.distance,
          distanceUnit: cardio.distanceUnit as "mi" | "km" | null,
        }
      : null,
  };
}

// ---- Writing ----------------------------------------------------------------

async function rememberLocation(db: Executor, locationId: string) {
  await db
    .insert(s.settings)
    .values({ id: 1, lastLocationId: locationId })
    .onConflictDoUpdate({
      target: s.settings.id,
      set: { lastLocationId: locationId },
    });
}

async function assertLocation(db: Executor, locationId: string) {
  const [row] = await db
    .select({ id: s.locations.id })
    .from(s.locations)
    .where(eq(s.locations.id, locationId));
  if (!row) throw new SessionQueryError(404, "Location not found.");
}

async function setsOf(db: Executor, sessionExerciseId: string) {
  const rows = await db
    .select()
    .from(s.sessionSets)
    .where(eq(s.sessionSets.sessionExerciseId, sessionExerciseId))
    .orderBy(asc(s.sessionSets.position));
  return rows.map(setFrom);
}

/**
 * Idempotent upsert of a session exercise. Name, load type and base weight are
 * snapshotted from the exercise on first insert and kept afterwards.
 */
export async function upsertSessionExercise(
  db: Executor,
  sessionId: string,
  input: SessionExerciseInput,
): Promise<SessionExerciseDto> {
  if (!(await sessionRow(db, sessionId)))
    throw new SessionQueryError(404, "Session not found.");
  const [existing] = await db
    .select()
    .from(s.sessionExercises)
    .where(eq(s.sessionExercises.id, input.id));
  if (existing && existing.sessionId !== sessionId)
    throw new SessionQueryError(409, "Exercise id belongs to another session.");

  // A program slot deleted since the preview loaded is simply dropped.
  let slotId = input.slotId;
  if (slotId) {
    const [slot] = await db
      .select({ id: s.programSlots.id })
      .from(s.programSlots)
      .where(eq(s.programSlots.id, slotId));
    if (!slot) slotId = null;
  }

  if (existing) {
    const [row] = await db
      .update(s.sessionExercises)
      .set({ position: input.position, slotId })
      .where(eq(s.sessionExercises.id, input.id))
      .returning();
    return exerciseFrom(row, await setsOf(db, row.id));
  }

  const [exercise] = await db
    .select()
    .from(s.exercises)
    .where(eq(s.exercises.id, input.exerciseId));
  if (!exercise) throw new SessionQueryError(404, "Exercise not found.");
  const [row] = await db
    .insert(s.sessionExercises)
    .values({
      id: input.id,
      sessionId,
      exerciseId: exercise.id,
      slotId,
      position: input.position,
      name: exercise.name,
      loadType: exercise.loadType,
      baseWeight: exercise.baseWeight,
    })
    .returning();
  return exerciseFrom(row, []);
}

/** Idempotent upsert of a set; volume is computed here, never by the client. */
export async function upsertSet(
  db: Executor,
  sessionId: string,
  sessionExerciseId: string,
  input: SessionSetInput,
): Promise<SessionSetDto> {
  const [exercise] = await db
    .select()
    .from(s.sessionExercises)
    .where(
      and(
        eq(s.sessionExercises.id, sessionExerciseId),
        eq(s.sessionExercises.sessionId, sessionId),
      ),
    );
  if (!exercise)
    throw new SessionQueryError(404, "Session exercise not found.");
  const session = await sessionRow(db, sessionId);
  if (!session) throw new SessionQueryError(404, "Session not found.");

  const [existing] = await db
    .select({ sessionExerciseId: s.sessionSets.sessionExerciseId })
    .from(s.sessionSets)
    .where(eq(s.sessionSets.id, input.id));
  if (existing && existing.sessionExerciseId !== sessionExerciseId)
    throw new SessionQueryError(409, "Set id belongs to another exercise.");

  const values = {
    position: input.position,
    weight: input.weight,
    reps: input.reps,
    done: input.done,
    volume: setVolume({
      loadType: exercise.loadType as LoadType,
      baseWeight: exercise.baseWeight,
      bodyweightLb: session.bodyweightLb,
      weight: input.weight,
      reps: input.reps,
      done: input.done,
    }),
  };
  const [row] = await db
    .insert(s.sessionSets)
    .values({ id: input.id, sessionExerciseId, ...values })
    .onConflictDoUpdate({ target: s.sessionSets.id, set: values })
    .returning();
  return setFrom(row);
}

/**
 * Idempotent upsert of a strength session with its exercises and sets. An
 * existing session keeps its header, snapshots and bodyweight.
 */
export async function createSession(
  db: Database,
  input: SessionCreateInput,
): Promise<SessionDto> {
  if (input.locationId) await assertLocation(db, input.locationId);
  await db.transaction(async (tx) => {
    const [settingsRow] = await tx
      .select({ bodyweightLb: s.settings.bodyweightLb })
      .from(s.settings)
      .where(eq(s.settings.id, 1));
    await tx
      .insert(s.sessions)
      .values({
        id: input.id,
        date: input.date ?? todayInAppTimeZone(),
        kind: "strength",
        locationId: input.locationId,
        programId: input.programId,
        programDayId: input.programDayId,
        title: input.title,
        dayName: input.dayName,
        bodyweightLb: settingsRow?.bodyweightLb ?? 0,
        notes: input.notes,
        startedAt: input.startedAt ? new Date(input.startedAt) : new Date(),
      })
      .onConflictDoNothing({ target: s.sessions.id });
    for (const exercise of input.exercises) {
      await upsertSessionExercise(tx, input.id, exercise);
      for (const set of exercise.sets)
        await upsertSet(tx, input.id, exercise.id, set);
    }
    if (input.locationId) await rememberLocation(tx, input.locationId);
  });
  const created = await getSession(db, input.id);
  if (!created) throw new SessionQueryError(500, "Session was not saved.");
  return created;
}

export async function patchSession(
  db: Database,
  id: string,
  patch: SessionPatchInput,
): Promise<SessionHeaderDto> {
  if (patch.locationId) await assertLocation(db, patch.locationId);
  return db.transaction(async (tx) => {
    const [row] = await tx
      .update(s.sessions)
      .set(patch)
      .where(eq(s.sessions.id, id))
      .returning();
    if (!row) throw new SessionQueryError(404, "Session not found.");
    if (patch.locationId) await rememberLocation(tx, patch.locationId);
    return headerFrom(row);
  });
}

/** Keeps an existing finish time when none is given, so retries are stable. */
export async function finishSession(
  db: Database,
  id: string,
  finishedAt?: string,
): Promise<SessionHeaderDto> {
  const row = await sessionRow(db, id);
  if (!row) throw new SessionQueryError(404, "Session not found.");
  const [updated] = await db
    .update(s.sessions)
    .set({
      finishedAt: finishedAt
        ? new Date(finishedAt)
        : (row.finishedAt ?? new Date()),
    })
    .where(eq(s.sessions.id, id))
    .returning();
  return headerFrom(updated);
}

export async function reopenSession(
  db: Database,
  id: string,
): Promise<SessionHeaderDto> {
  const [row] = await db
    .update(s.sessions)
    .set({ finishedAt: null })
    .where(eq(s.sessions.id, id))
    .returning();
  if (!row) throw new SessionQueryError(404, "Session not found.");
  return headerFrom(row);
}

/** Deleting is idempotent: a missing row is already gone. */
export async function deleteSessionExercise(
  db: Database,
  sessionId: string,
  sessionExerciseId: string,
): Promise<void> {
  await db
    .delete(s.sessionExercises)
    .where(
      and(
        eq(s.sessionExercises.id, sessionExerciseId),
        eq(s.sessionExercises.sessionId, sessionId),
      ),
    );
}

export async function deleteSet(
  db: Database,
  sessionId: string,
  sessionExerciseId: string,
  setId: string,
): Promise<void> {
  const owned = db
    .select({ id: s.sessionExercises.id })
    .from(s.sessionExercises)
    .where(
      and(
        eq(s.sessionExercises.id, sessionExerciseId),
        eq(s.sessionExercises.sessionId, sessionId),
      ),
    );
  await db
    .delete(s.sessionSets)
    .where(
      and(
        eq(s.sessionSets.id, setId),
        eq(s.sessionSets.sessionExerciseId, sessionExerciseId),
        inArray(s.sessionSets.sessionExerciseId, owned),
      ),
    );
}

// ---- Start / logger data ----------------------------------------------------

export interface SessionCatalog {
  locations: LocationDto[];
  exercises: ExerciseDto[];
  movements: MovementDto[];
  programs: ProgramDto[];
  settings: SettingsDto;
  /** Next day id per program (design §13.2); null when it has no days. */
  nextDayByProgram: Record<string, string | null>;
  /** ISO time an exercise was last done anywhere. */
  lastUsedAnywhere: Record<string, string>;
  /** locationId -> exerciseId -> ISO time of last done set there. */
  lastUsedByLocation: Record<string, Record<string, string>>;
  /** Done sets from the most recent earlier session, per exercise. */
  lastSets: Record<string, LastSetDto[]>;
}

/**
 * Everything the preview and the logger need, loaded in one go so location
 * and day changes re-resolve instantly on the client with the pure domain
 * functions. `excludeSessionId` keeps the open session out of "last time".
 */
export async function loadCatalog(
  db: Database,
  options: { excludeSessionId?: string } = {},
): Promise<SessionCatalog> {
  const exclude = options.excludeSessionId;

  const [
    locationRows,
    locationEquipmentRows,
    exerciseRows,
    exerciseEquipmentRows,
    movementRows,
    programRows,
    dayRows,
    slotRows,
    settingsRows,
    doneSets,
    programSessions,
  ] = await Promise.all([
    db
      .select()
      .from(s.locations)
      .where(sql`${s.locations.archivedAt} is null`)
      .orderBy(asc(s.locations.name)),
    db.select().from(s.locationEquipment),
    db
      .select()
      .from(s.exercises)
      .where(sql`${s.exercises.archivedAt} is null`)
      .orderBy(asc(s.exercises.name)),
    db.select().from(s.exerciseEquipment),
    db.select().from(s.movements).orderBy(asc(s.movements.name)),
    db
      .select()
      .from(s.programs)
      .where(sql`${s.programs.archivedAt} is null`)
      .orderBy(asc(s.programs.createdAt)),
    db.select().from(s.programDays).orderBy(asc(s.programDays.position)),
    db.select().from(s.programSlots).orderBy(asc(s.programSlots.position)),
    db.select().from(s.settings).where(eq(s.settings.id, 1)),
    db
      .select({
        exerciseId: s.sessionExercises.exerciseId,
        sessionExerciseId: s.sessionExercises.id,
        locationId: s.sessions.locationId,
        startedAt: s.sessions.startedAt,
        position: s.sessionSets.position,
        weight: s.sessionSets.weight,
        reps: s.sessionSets.reps,
      })
      .from(s.sessionSets)
      .innerJoin(
        s.sessionExercises,
        eq(s.sessionSets.sessionExerciseId, s.sessionExercises.id),
      )
      .innerJoin(s.sessions, eq(s.sessionExercises.sessionId, s.sessions.id))
      .where(
        and(
          eq(s.sessionSets.done, true),
          isNotNull(s.sessionExercises.exerciseId),
          eq(s.sessions.kind, "strength"),
          exclude ? ne(s.sessions.id, exclude) : undefined,
        ),
      )
      .orderBy(
        desc(s.sessions.date),
        desc(s.sessions.startedAt),
        asc(s.sessionSets.position),
      ),
    db
      .select({
        programId: s.sessions.programId,
        programDayId: s.sessions.programDayId,
        date: s.sessions.date,
        startedAt: s.sessions.startedAt,
        doneSetCount:
          sql<number>`count(${s.sessionSets.id}) filter (where ${s.sessionSets.done})`.mapWith(
            Number,
          ),
      })
      .from(s.sessions)
      .leftJoin(
        s.sessionExercises,
        eq(s.sessionExercises.sessionId, s.sessions.id),
      )
      .leftJoin(
        s.sessionSets,
        eq(s.sessionSets.sessionExerciseId, s.sessionExercises.id),
      )
      .where(
        and(isNotNull(s.sessions.programId), eq(s.sessions.kind, "strength")),
      )
      .groupBy(s.sessions.id),
  ]);

  const locations: LocationDto[] = locationRows.map((location) => ({
    id: location.id,
    name: location.name,
    archived: false,
    equipment: locationEquipmentRows
      .filter((row) => row.locationId === location.id)
      .map((row) => ({ equipmentId: row.equipmentId, weights: row.weights })),
  }));

  const exercises: ExerciseDto[] = exerciseRows.map((exercise) => ({
    id: exercise.id,
    name: exercise.name,
    movementId: exercise.movementId,
    loadType: exercise.loadType as LoadType,
    baseWeight: exercise.baseWeight,
    weightEquipmentId: exercise.weightEquipmentId,
    increment: exercise.increment,
    archived: false,
    equipmentIds: exerciseEquipmentRows
      .filter((row) => row.exerciseId === exercise.id)
      .map((row) => row.equipmentId),
  }));

  const programs: ProgramDto[] = programRows.map((program) => ({
    id: program.id,
    name: program.name,
    archived: false,
    days: dayRows
      .filter((day) => day.programId === program.id)
      .map((day) => ({
        id: day.id,
        name: day.name,
        position: day.position,
        slots: slotRows
          .filter((slot) => slot.dayId === day.id)
          .map((slot) => ({
            id: slot.id,
            position: slot.position,
            movementId: slot.movementId,
            exerciseId: slot.exerciseId,
            sets: slot.targetSets,
            repMin: slot.repMin,
            repMax: slot.repMax,
            amrap: slot.amrap,
            notes: slot.notes,
          })),
      })),
  }));

  const settingsRow = settingsRows[0];
  const settings: SettingsDto = {
    bodyweightLb: settingsRow?.bodyweightLb ?? 0,
    activeProgramId: settingsRow?.activeProgramId ?? null,
    lastLocationId: settingsRow?.lastLocationId ?? null,
  };

  const nextDayByProgram = Object.fromEntries(
    programs.map((program) => [
      program.id,
      nextProgramDay(
        program.days,
        programSessions
          .filter((row) => row.programId === program.id)
          .map((row) => ({
            programId: row.programId,
            programDayId: row.programDayId,
            date: row.date,
            startedAt: iso(row.startedAt),
            doneSetCount: row.doneSetCount,
          })),
      ),
    ]),
  );

  return {
    locations,
    exercises,
    movements: movementRows.map((m) => ({ id: m.id, name: m.name })),
    programs,
    settings,
    nextDayByProgram,
    ...usageFrom(doneSets),
  };
}

/** Rows arrive newest session first, then by set position. */
function usageFrom(
  rows: {
    exerciseId: string | null;
    sessionExerciseId: string;
    locationId: string | null;
    startedAt: Date;
    position: number;
    weight: number;
    reps: number | null;
  }[],
) {
  const lastUsedAnywhere: Record<string, string> = {};
  const lastUsedByLocation: Record<string, Record<string, string>> = {};
  const lastSets: Record<string, LastSetDto[]> = {};
  const lastSessionExercise: Record<string, string> = {};
  for (const row of rows) {
    if (!row.exerciseId) continue;
    const when = iso(row.startedAt);
    lastUsedAnywhere[row.exerciseId] ??= when;
    if (row.locationId) {
      const here = (lastUsedByLocation[row.locationId] ??= {});
      here[row.exerciseId] ??= when;
    }
    lastSessionExercise[row.exerciseId] ??= row.sessionExerciseId;
    if (lastSessionExercise[row.exerciseId] === row.sessionExerciseId)
      (lastSets[row.exerciseId] ??= []).push({
        position: row.position,
        weight: row.weight,
        reps: row.reps,
      });
  }
  return { lastUsedAnywhere, lastUsedByLocation, lastSets };
}

/** Targets of the program slots a session's exercises came from. */
export async function loadSlotTargets(
  db: Database,
  slotIds: string[],
): Promise<Record<string, SetTarget>> {
  if (slotIds.length === 0) return {};
  const rows = await db
    .select()
    .from(s.programSlots)
    .where(inArray(s.programSlots.id, slotIds));
  return Object.fromEntries(
    rows.map((slot) => [
      slot.id,
      {
        sets: slot.targetSets,
        repMin: slot.repMin,
        repMax: slot.repMax,
        amrap: slot.amrap,
      },
    ]),
  );
}
