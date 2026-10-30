import {
  and,
  asc,
  count,
  desc,
  eq,
  gte,
  inArray,
  isNull,
  lt,
  lte,
  or,
  sql,
  type SQL,
} from "drizzle-orm";
import type { Database } from "@/db/client";
import * as s from "@/db/schema";
import {
  addDays,
  monthBounds,
  todayInAppTimeZone,
  weekBounds,
} from "@/lib/dates";
import type {
  HistoryPageDto,
  PeriodSummaryDto,
  SessionDetailDto,
  SummaryResponseDto,
  TodayDataDto,
} from "@/features/history/types";
import type {
  CardioEntryDto,
  DistanceUnit,
  ExerciseHistoryDto,
  LoadType,
  SessionDto,
  SessionKind,
  SessionSummaryDto,
} from "@/types/domain";

const DAY_MS = 24 * 60 * 60 * 1000;

const hasDoneSet = sql`exists (select 1 from ${s.sessionExercises} join ${s.sessionSets} on ${s.sessionSets.sessionExerciseId} = ${s.sessionExercises.id} where ${s.sessionExercises.sessionId} = ${s.sessions.id} and ${s.sessionSets.done})`;

function toCardio(
  row: typeof s.cardioEntries.$inferSelect | null,
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

async function selectSummaries(
  db: Database,
  where: SQL | undefined,
  limit?: number,
): Promise<SessionSummaryDto[]> {
  const query = db
    .select({
      session: s.sessions,
      locationName: s.locations.name,
      cardio: s.cardioEntries,
    })
    .from(s.sessions)
    .leftJoin(s.locations, eq(s.locations.id, s.sessions.locationId))
    .leftJoin(s.cardioEntries, eq(s.cardioEntries.sessionId, s.sessions.id))
    .where(where)
    .orderBy(desc(s.sessions.date), desc(s.sessions.startedAt))
    .$dynamic();
  const rows = await (limit ? query.limit(limit) : query);
  if (rows.length === 0) return [];

  const aggregates = await db
    .select({
      sessionId: s.sessionExercises.sessionId,
      exerciseCount: sql<number>`count(distinct ${s.sessionExercises.id})`,
      doneSetCount: sql<number>`count(${s.sessionSets.id}) filter (where ${s.sessionSets.done})`,
      volume: sql<number>`coalesce(sum(${s.sessionSets.volume}) filter (where ${s.sessionSets.done}), 0)`,
    })
    .from(s.sessionExercises)
    .leftJoin(
      s.sessionSets,
      eq(s.sessionSets.sessionExerciseId, s.sessionExercises.id),
    )
    .where(
      inArray(
        s.sessionExercises.sessionId,
        rows.map((row) => row.session.id),
      ),
    )
    .groupBy(s.sessionExercises.sessionId);
  const bySession = new Map(aggregates.map((a) => [a.sessionId, a]));

  return rows.map(({ session, locationName, cardio }) => {
    const agg = bySession.get(session.id);
    return {
      id: session.id,
      date: session.date,
      kind: session.kind as SessionKind,
      title: session.title,
      dayName: session.dayName,
      locationId: session.locationId,
      locationName,
      startedAt: session.startedAt.toISOString(),
      finishedAt: session.finishedAt?.toISOString() ?? null,
      exerciseCount: Number(agg?.exerciseCount ?? 0),
      doneSetCount: Number(agg?.doneSetCount ?? 0),
      totalVolume: Number(agg?.volume ?? 0),
      cardio: toCardio(cardio),
    };
  });
}

/** Every session on a date (including empty ones in progress), oldest first. */
export async function listTodaySessions(
  db: Database,
  date: string,
): Promise<SessionSummaryDto[]> {
  const rows = await selectSummaries(db, eq(s.sessions.date, date));
  return rows.reverse();
}

export async function getTodayData(
  db: Database,
  date = todayInAppTimeZone(),
): Promise<TodayDataDto> {
  const [sessions, [exerciseCount]] = await Promise.all([
    listTodaySessions(db, date),
    db
      .select({ n: count() })
      .from(s.exercises)
      .where(isNull(s.exercises.archivedAt)),
  ]);
  return { date, sessions, hasExercises: (exerciseCount?.n ?? 0) > 0 };
}

/** Strength sessions with no done sets are hidden once they are 24h old. */
function visibleInHistory(now: Date): SQL {
  const cutoff = new Date(now.getTime() - DAY_MS).toISOString();
  return sql`not (${s.sessions.kind} = 'strength' and ${s.sessions.startedAt} < ${cutoff}::timestamptz and not ${hasDoneSet})`;
}

/**
 * Newest first, paged by whole dates: a page always ends on a date boundary,
 * so the cursor (`before`, exclusive) never splits a day.
 */
export async function listHistory(
  db: Database,
  { before, limit = 50 }: { before?: string; limit?: number },
  now = new Date(),
): Promise<HistoryPageDto> {
  const base: SQL[] = [visibleInHistory(now)];
  if (before) base.push(lt(s.sessions.date, before));
  const rows = await selectSummaries(db, and(...base), limit + 1);
  if (rows.length <= limit) return { sessions: rows, nextCursor: null };

  const cut = rows[limit - 1].date;
  const page =
    rows[limit].date === cut
      ? await selectSummaries(db, and(...base, gte(s.sessions.date, cut)))
      : rows.slice(0, limit);
  return { sessions: page, nextCursor: cut };
}

export async function getSessionDetail(
  db: Database,
  id: string,
): Promise<SessionDetailDto | null> {
  const [row] = await db
    .select({
      session: s.sessions,
      locationName: s.locations.name,
      cardio: s.cardioEntries,
    })
    .from(s.sessions)
    .leftJoin(s.locations, eq(s.locations.id, s.sessions.locationId))
    .leftJoin(s.cardioEntries, eq(s.cardioEntries.sessionId, s.sessions.id))
    .where(eq(s.sessions.id, id));
  if (!row) return null;

  const exerciseRows = await db
    .select()
    .from(s.sessionExercises)
    .where(eq(s.sessionExercises.sessionId, id))
    .orderBy(asc(s.sessionExercises.position));
  const setRows = exerciseRows.length
    ? await db
        .select()
        .from(s.sessionSets)
        .where(
          inArray(
            s.sessionSets.sessionExerciseId,
            exerciseRows.map((e) => e.id),
          ),
        )
        .orderBy(asc(s.sessionSets.position))
    : [];

  const { session } = row;
  const dto: SessionDto = {
    id: session.id,
    date: session.date,
    kind: session.kind as SessionKind,
    locationId: session.locationId,
    programId: session.programId,
    programDayId: session.programDayId,
    title: session.title,
    dayName: session.dayName,
    bodyweightLb: session.bodyweightLb,
    notes: session.notes,
    startedAt: session.startedAt.toISOString(),
    finishedAt: session.finishedAt?.toISOString() ?? null,
    exercises: exerciseRows.map((e) => ({
      id: e.id,
      sessionId: e.sessionId,
      exerciseId: e.exerciseId,
      slotId: e.slotId,
      position: e.position,
      name: e.name,
      loadType: e.loadType as LoadType,
      baseWeight: e.baseWeight,
      sets: setRows
        .filter((set) => set.sessionExerciseId === e.id)
        .map((set) => ({
          id: set.id,
          sessionExerciseId: set.sessionExerciseId,
          position: set.position,
          weight: set.weight,
          reps: set.reps,
          done: set.done,
          volume: set.volume,
        })),
    })),
    cardio: toCardio(row.cardio),
  };
  return { session: dto, locationName: row.locationName };
}

export async function getExerciseHistory(
  db: Database,
  exerciseId: string,
  limit = 30,
): Promise<ExerciseHistoryDto | null> {
  const [exercise] = await db
    .select()
    .from(s.exercises)
    .where(eq(s.exercises.id, exerciseId));

  const rows = await db
    .select({
      sessionId: s.sessions.id,
      date: s.sessions.date,
      locationName: s.locations.name,
      name: s.sessionExercises.name,
      loadType: s.sessionExercises.loadType,
      position: s.sessionSets.position,
      weight: s.sessionSets.weight,
      reps: s.sessionSets.reps,
      volume: s.sessionSets.volume,
    })
    .from(s.sessionSets)
    .innerJoin(
      s.sessionExercises,
      eq(s.sessionExercises.id, s.sessionSets.sessionExerciseId),
    )
    .innerJoin(s.sessions, eq(s.sessions.id, s.sessionExercises.sessionId))
    .leftJoin(s.locations, eq(s.locations.id, s.sessions.locationId))
    .where(
      and(
        eq(s.sessionExercises.exerciseId, exerciseId),
        eq(s.sessionSets.done, true),
      ),
    )
    .orderBy(
      desc(s.sessions.date),
      desc(s.sessions.startedAt),
      asc(s.sessionSets.position),
    );
  if (!exercise && rows.length === 0) return null;

  const grouped = new Map<string, ExerciseHistoryDto["sessions"][number]>();
  let best: ExerciseHistoryDto["bestSet"] = null;
  for (const row of rows) {
    let entry = grouped.get(row.sessionId);
    if (!entry) {
      if (grouped.size >= limit) continue;
      entry = {
        sessionId: row.sessionId,
        date: row.date,
        locationName: row.locationName,
        sets: [],
        totalVolume: 0,
      };
      grouped.set(row.sessionId, entry);
    }
    entry.sets.push({
      position: row.position,
      weight: row.weight,
      reps: row.reps,
      volume: row.volume,
    });
    entry.totalVolume += row.volume;
    if (row.reps && row.volume > 0 && (!best || row.volume > best.volume)) {
      best = {
        sessionId: row.sessionId,
        date: row.date,
        weight: row.weight,
        reps: row.reps,
        volume: row.volume,
      };
    }
  }
  const sessions = [...grouped.values()].map((entry) => ({
    ...entry,
    totalVolume: Math.round(entry.totalVolume * 100) / 100,
  }));

  return {
    exerciseId,
    name: exercise?.name ?? rows[0]?.name ?? "Exercise",
    loadType: (exercise?.loadType ?? rows[0]?.loadType ?? "total") as LoadType,
    sessions,
    bestSet: best,
  };
}

function periodBounds(period: "week" | "month", anchor: string) {
  return period === "week" ? weekBounds(anchor) : monthBounds(anchor);
}

/** Sessions that count in a summary: cardio, or strength with a done set. */
function countsInSummary(start: string, end: string): SQL | undefined {
  return and(
    gte(s.sessions.date, start),
    lte(s.sessions.date, end),
    or(eq(s.sessions.kind, "cardio"), hasDoneSet),
  );
}

export async function getSummary(
  db: Database,
  {
    period,
    anchor = todayInAppTimeZone(),
    count: periodCount = 1,
  }: { period: "week" | "month"; anchor?: string; count?: number },
): Promise<SummaryResponseDto> {
  const bounds = [periodBounds(period, anchor)];
  for (let i = 1; i < periodCount; i += 1) {
    bounds.push(periodBounds(period, addDays(bounds[i - 1].start, -1)));
  }
  const overall = {
    start: bounds[bounds.length - 1].start,
    end: bounds[0].end,
  };
  const sessions = await selectSummaries(
    db,
    countsInSummary(overall.start, overall.end),
  );

  const periods: PeriodSummaryDto[] = bounds.map(({ start, end }) => {
    const inRange = sessions.filter((x) => x.date >= start && x.date <= end);
    const total = inRange.reduce((sum, x) => sum + x.totalVolume, 0);
    return {
      start,
      end,
      totalVolume: Math.round(total * 100) / 100,
      sessionCount: inRange.length,
      strengthCount: inRange.filter((x) => x.kind === "strength").length,
      cardioCount: inRange.filter((x) => x.kind === "cardio").length,
    };
  });
  const current = periods[0];
  return {
    period,
    current,
    periods,
    sessions: sessions.filter(
      (x) => x.date >= current.start && x.date <= current.end,
    ),
  };
}
