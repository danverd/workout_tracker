import {
  and,
  asc,
  desc,
  eq,
  getTableColumns,
  inArray,
  isNotNull,
  ne,
  sql,
} from "drizzle-orm";
import type { Database } from "@/db/client";
import { toExerciseDto, toLocationDto } from "@/db/queries/setup";
import { toSlotDto } from "@/db/queries/programs";
import { HttpError } from "@/lib/http";
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
  CardioEntryDto,
  DistanceUnit,
  LastSetDto,
  LoadType,
  ProgramDto,
  SessionDto,
  SessionExerciseDto,
  SessionCatalog,
  SessionHeaderDto,
  SessionSetDto,
  SettingsDto,
} from "@/types/domain";

/** Error with an HTTP status, mapped to a JSON response by the routes. */
export class SessionQueryError extends HttpError {
  constructor(status: number, message: string) {
    super(status, message);
    this.name = "SessionQueryError";
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

export function toCardio(
  row: typeof s.cardioEntries.$inferSelect | null | undefined,
): CardioEntryDto | null {
  return row
    ? {
        activity: row.activity,
        durationSec: row.durationSec,
        distance: row.distance,
        distanceUnit: row.distanceUnit as DistanceUnit | null,
      }
    : null;
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
  const [[row], exerciseRows, cardioRows, setRows] = await Promise.all([
    db.select().from(s.sessions).where(eq(s.sessions.id, id)),
    db
      .select()
      .from(s.sessionExercises)
      .where(eq(s.sessionExercises.sessionId, id))
      .orderBy(asc(s.sessionExercises.position)),
    db.select().from(s.cardioEntries).where(eq(s.cardioEntries.sessionId, id)),
    db
      .select(getTableColumns(s.sessionSets))
      .from(s.sessionSets)
      .innerJoin(
        s.sessionExercises,
        eq(s.sessionSets.sessionExerciseId, s.sessionExercises.id),
      )
      .where(eq(s.sessionExercises.sessionId, id))
      .orderBy(asc(s.sessionSets.position)),
  ]);
  if (!row) return null;
  const setsByExercise = groupSets(setRows);
  return {
    ...headerFrom(row),
    exercises: exerciseRows.map((exercise) =>
      exerciseFrom(exercise, setsByExercise.get(exercise.id) ?? []),
    ),
    cardio: toCardio(cardioRows[0]),
  };
}

function groupSets(rows: (typeof s.sessionSets.$inferSelect)[]) {
  const byExercise = new Map<string, SessionSetDto[]>();
  for (const row of rows) {
    const list = byExercise.get(row.sessionExerciseId) ?? [];
    list.push(setFrom(row));
    byExercise.set(row.sessionExerciseId, list);
  }
  return byExercise;
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
  const [[session], [existing], [slot], [exercise]] = await Promise.all([
    db
      .select({ id: s.sessions.id })
      .from(s.sessions)
      .where(eq(s.sessions.id, sessionId)),
    db
      .select()
      .from(s.sessionExercises)
      .where(eq(s.sessionExercises.id, input.id)),
    input.slotId
      ? db
          .select({ id: s.programSlots.id })
          .from(s.programSlots)
          .where(eq(s.programSlots.id, input.slotId))
      : Promise.resolve([]),
    db.select().from(s.exercises).where(eq(s.exercises.id, input.exerciseId)),
  ]);
  if (!session) throw new SessionQueryError(404, "Session not found.");
  if (existing && existing.sessionId !== sessionId)
    throw new SessionQueryError(409, "Exercise id belongs to another session.");

  // A program slot deleted since the preview loaded is simply dropped.
  const slotId = slot ? input.slotId : null;

  if (existing) {
    const [row] = await db
      .update(s.sessionExercises)
      .set({ position: input.position, slotId })
      .where(eq(s.sessionExercises.id, input.id))
      .returning();
    return exerciseFrom(row, await setsOf(db, row.id));
  }

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
  const [[exercise], [session], [existing]] = await Promise.all([
    db
      .select({
        loadType: s.sessionExercises.loadType,
        baseWeight: s.sessionExercises.baseWeight,
      })
      .from(s.sessionExercises)
      .where(
        and(
          eq(s.sessionExercises.id, sessionExerciseId),
          eq(s.sessionExercises.sessionId, sessionId),
        ),
      ),
    db
      .select({ bodyweightLb: s.sessions.bodyweightLb })
      .from(s.sessions)
      .where(eq(s.sessions.id, sessionId)),
    db
      .select({ sessionExerciseId: s.sessionSets.sessionExerciseId })
      .from(s.sessionSets)
      .where(eq(s.sessionSets.id, input.id)),
  ]);
  if (!exercise)
    throw new SessionQueryError(404, "Session exercise not found.");
  if (!session) throw new SessionQueryError(404, "Session not found.");
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

const excluded = (column: { name: string }) =>
  sql.raw(`excluded."${column.name}"`);

/**
 * Idempotent upsert of a strength session with its exercises and sets. An
 * existing session keeps its header, snapshots and bodyweight. Exercises and
 * sets are written with one bulk statement each.
 */
export async function createSession(
  db: Database,
  input: SessionCreateInput,
): Promise<SessionDto> {
  if (input.locationId) await assertLocation(db, input.locationId);
  return db.transaction(async (tx) => {
    const [settingsRow] = await tx
      .select({ bodyweightLb: s.settings.bodyweightLb })
      .from(s.settings)
      .where(eq(s.settings.id, 1));
    const inserted = await tx
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
      .onConflictDoNothing({ target: s.sessions.id })
      .returning();
    const session = inserted[0] ?? (await sessionRow(tx, input.id))!;

    // Later duplicates of an id win, as they did when written one by one.
    const exercises = [
      ...new Map(input.exercises.map((e) => [e.id, e])).values(),
    ];
    const sets = [
      ...new Map(
        exercises.flatMap((e) =>
          e.sets.map((set) => [set.id, { exerciseId: e.id, set }] as const),
        ),
      ).values(),
    ];
    const requestedSlotIds = exercises.flatMap((e) =>
      e.slotId ? [e.slotId] : [],
    );
    const [existingExercises, exerciseDefs, slots, existingSets] =
      exercises.length
        ? await Promise.all([
            tx
              .select()
              .from(s.sessionExercises)
              .where(
                inArray(
                  s.sessionExercises.id,
                  exercises.map((e) => e.id),
                ),
              ),
            tx
              .select()
              .from(s.exercises)
              .where(
                inArray(s.exercises.id, [
                  ...new Set(exercises.map((e) => e.exerciseId)),
                ]),
              ),
            requestedSlotIds.length
              ? tx
                  .select({ id: s.programSlots.id })
                  .from(s.programSlots)
                  .where(inArray(s.programSlots.id, requestedSlotIds))
              : Promise.resolve([]),
            sets.length
              ? tx
                  .select({
                    id: s.sessionSets.id,
                    sessionExerciseId: s.sessionSets.sessionExerciseId,
                  })
                  .from(s.sessionSets)
                  .where(
                    inArray(
                      s.sessionSets.id,
                      sets.map((x) => x.set.id),
                    ),
                  )
              : Promise.resolve([]),
          ])
        : [[], [], [], []];

    const existingById = new Map(existingExercises.map((e) => [e.id, e]));
    const defById = new Map(exerciseDefs.map((e) => [e.id, e]));
    const slotIds = new Set(slots.map((slot) => slot.id));
    const setOwner = new Map(
      existingSets.map((x) => [x.id, x.sessionExerciseId]),
    );

    const exerciseValues = exercises.map((e) => {
      const existing = existingById.get(e.id);
      if (existing && existing.sessionId !== input.id)
        throw new SessionQueryError(
          409,
          "Exercise id belongs to another session.",
        );
      const def = defById.get(e.exerciseId);
      if (!existing && !def)
        throw new SessionQueryError(404, "Exercise not found.");
      const snapshot = existing ?? {
        exerciseId: def!.id,
        name: def!.name,
        loadType: def!.loadType,
        baseWeight: def!.baseWeight,
      };
      return {
        id: e.id,
        sessionId: input.id,
        exerciseId: snapshot.exerciseId,
        slotId: e.slotId && slotIds.has(e.slotId) ? e.slotId : null,
        position: e.position,
        name: snapshot.name,
        loadType: snapshot.loadType,
        baseWeight: snapshot.baseWeight,
      };
    });
    const exerciseRows = exerciseValues.length
      ? await tx
          .insert(s.sessionExercises)
          .values(exerciseValues)
          .onConflictDoUpdate({
            target: s.sessionExercises.id,
            set: {
              position: excluded(s.sessionExercises.position),
              slotId: excluded(s.sessionExercises.slotId),
            },
          })
          .returning()
      : [];
    const rowById = new Map(exerciseRows.map((row) => [row.id, row]));

    const setValues = sets.map(({ exerciseId, set }) => {
      const owner = setOwner.get(set.id);
      if (owner && owner !== exerciseId)
        throw new SessionQueryError(409, "Set id belongs to another exercise.");
      const exercise = rowById.get(exerciseId)!;
      return {
        id: set.id,
        sessionExerciseId: exerciseId,
        position: set.position,
        weight: set.weight,
        reps: set.reps,
        done: set.done,
        volume: setVolume({
          loadType: exercise.loadType as LoadType,
          baseWeight: exercise.baseWeight,
          bodyweightLb: session.bodyweightLb,
          weight: set.weight,
          reps: set.reps,
          done: set.done,
        }),
      };
    });
    const setRows = setValues.length
      ? await tx
          .insert(s.sessionSets)
          .values(setValues)
          .onConflictDoUpdate({
            target: s.sessionSets.id,
            set: {
              position: excluded(s.sessionSets.position),
              weight: excluded(s.sessionSets.weight),
              reps: excluded(s.sessionSets.reps),
              done: excluded(s.sessionSets.done),
              volume: excluded(s.sessionSets.volume),
            },
          })
          .returning()
      : [];
    if (input.locationId) await rememberLocation(tx, input.locationId);

    // A replay onto an existing session may hold more than this payload.
    if (!inserted[0]) {
      const full = await getSession(tx, input.id);
      if (!full) throw new SessionQueryError(500, "Session was not saved.");
      return full;
    }
    const setsByExercise = groupSets(
      setRows.sort((a, b) => a.position - b.position),
    );
    return {
      ...headerFrom(session),
      exercises: exerciseRows
        .sort((a, b) => a.position - b.position)
        .map((row) => exerciseFrom(row, setsByExercise.get(row.id) ?? [])),
      cardio: null,
    };
  });
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

  const doneSetOf = (sessionExerciseId: typeof s.sessionExercises.id) =>
    sql`exists (select 1 from ${s.sessionSets} where ${s.sessionSets.sessionExerciseId} = ${sessionExerciseId} and ${s.sessionSets.done})`;
  const inScope = (excludeId: typeof s.sessions.id) =>
    and(
      eq(s.sessions.kind, "strength"),
      exclude ? ne(excludeId, exclude) : undefined,
    );

  // Newest session-exercise per exercise that has a done set.
  const latest = db
    .selectDistinctOn([s.sessionExercises.exerciseId], {
      exerciseId: s.sessionExercises.exerciseId,
      sessionExerciseId: s.sessionExercises.id,
    })
    .from(s.sessionExercises)
    .innerJoin(s.sessions, eq(s.sessionExercises.sessionId, s.sessions.id))
    .where(
      and(
        isNotNull(s.sessionExercises.exerciseId),
        inScope(s.sessions.id),
        doneSetOf(s.sessionExercises.id),
      ),
    )
    .orderBy(
      s.sessionExercises.exerciseId,
      desc(s.sessions.date),
      desc(s.sessions.startedAt),
      asc(s.sessionExercises.id),
    )
    .as("latest");

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
    lastSetRows,
    usageRows,
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
    // Done sets of those latest session-exercises, already in set order.
    db
      .select({
        exerciseId: latest.exerciseId,
        position: s.sessionSets.position,
        weight: s.sessionSets.weight,
        reps: s.sessionSets.reps,
      })
      .from(latest)
      .innerJoin(
        s.sessionSets,
        eq(s.sessionSets.sessionExerciseId, latest.sessionExerciseId),
      )
      .where(eq(s.sessionSets.done, true))
      .orderBy(asc(s.sessionSets.position)),
    // Last done time per exercise and location.
    db
      .select({
        exerciseId: s.sessionExercises.exerciseId,
        locationId: s.sessions.locationId,
        lastAt: sql<Date>`max(${s.sessions.startedAt})`.mapWith(
          s.sessions.startedAt,
        ),
      })
      .from(s.sessionExercises)
      .innerJoin(s.sessions, eq(s.sessionExercises.sessionId, s.sessions.id))
      .where(
        and(
          isNotNull(s.sessionExercises.exerciseId),
          inScope(s.sessions.id),
          doneSetOf(s.sessionExercises.id),
        ),
      )
      .groupBy(s.sessionExercises.exerciseId, s.sessions.locationId),
    // Newest session with a done set per program: all rotation needs.
    db
      .selectDistinctOn([s.sessions.programId], {
        programId: s.sessions.programId,
        programDayId: s.sessions.programDayId,
        date: s.sessions.date,
        startedAt: s.sessions.startedAt,
      })
      .from(s.sessions)
      .where(
        and(
          isNotNull(s.sessions.programId),
          eq(s.sessions.kind, "strength"),
          sql`exists (select 1 from ${s.sessionExercises} join ${s.sessionSets} on ${s.sessionSets.sessionExerciseId} = ${s.sessionExercises.id} where ${s.sessionExercises.sessionId} = ${s.sessions.id} and ${s.sessionSets.done})`,
        ),
      )
      .orderBy(
        s.sessions.programId,
        desc(s.sessions.date),
        desc(s.sessions.startedAt),
      ),
  ]);

  const locations = locationRows.map((row) =>
    toLocationDto(row, locationEquipmentRows),
  );
  const exercises = exerciseRows.map((row) =>
    toExerciseDto(row, exerciseEquipmentRows),
  );

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
        slots: slotRows.filter((slot) => slot.dayId === day.id).map(toSlotDto),
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
            // The query only returns sessions that have a done set.
            doneSetCount: 1,
          })),
      ),
    ]),
  );

  const lastUsedAnywhere: Record<string, string> = {};
  const lastUsedByLocation: Record<string, Record<string, string>> = {};
  for (const row of usageRows) {
    if (!row.exerciseId) continue;
    const when = iso(row.lastAt);
    if (
      !lastUsedAnywhere[row.exerciseId] ||
      when > lastUsedAnywhere[row.exerciseId]
    )
      lastUsedAnywhere[row.exerciseId] = when;
    if (row.locationId)
      (lastUsedByLocation[row.locationId] ??= {})[row.exerciseId] = when;
  }
  const lastSets: Record<string, LastSetDto[]> = {};
  for (const row of lastSetRows) {
    if (!row.exerciseId) continue;
    (lastSets[row.exerciseId] ??= []).push({
      position: row.position,
      weight: row.weight,
      reps: row.reps,
    });
  }

  return {
    locations,
    exercises,
    movements: movementRows.map((m) => ({ id: m.id, name: m.name })),
    programs,
    settings,
    nextDayByProgram,
    lastUsedAnywhere,
    lastUsedByLocation,
    lastSets,
  };
}
