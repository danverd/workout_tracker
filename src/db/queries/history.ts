import { round2 } from "@/lib/format";
import {
  and,
  asc,
  count,
  desc,
  eq,
  gt,
  gte,
  inArray,
  isNotNull,
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
import { getSession, toCardio } from "@/db/queries/sessions";
import type {
  CardioEntryDto,
  ExerciseHistoryDto,
  LoadType,
  SessionKind,
  SessionSummaryDto,
} from "@/types/domain";

const DAY_MS = 24 * 60 * 60 * 1000;

const hasDoneSet = sql`exists (select 1 from ${s.sessionExercises} join ${s.sessionSets} on ${s.sessionSets.sessionExerciseId} = ${s.sessionExercises.id} where ${s.sessionExercises.sessionId} = ${s.sessions.id} and ${s.sessionSets.done})`;

interface SummaryRow {
  session: {
    id: string;
    date: string;
    kind: string;
    title: string;
    dayName: string;
    locationId: string | null;
    startedAt: Date;
    finishedAt: Date | null;
  };
  locationName: string | null;
  cardio: CardioEntryDto | null;
  exerciseCount: number;
  doneSetCount: number;
  volume: number;
}

function toSessionSummaryDto(row: SummaryRow): SessionSummaryDto {
  const { session } = row;
  return {
    id: session.id,
    date: session.date,
    kind: session.kind as SessionKind,
    title: session.title,
    dayName: session.dayName,
    locationId: session.locationId,
    locationName: row.locationName,
    startedAt: session.startedAt.toISOString(),
    finishedAt: session.finishedAt?.toISOString() ?? null,
    exerciseCount: Number(row.exerciseCount),
    doneSetCount: Number(row.doneSetCount),
    totalVolume: Number(row.volume),
    cardio: row.cardio,
  };
}

/** Sessions with their location, cardio entry and set totals in one query. */
async function selectSummaries(
  db: Database,
  where: SQL | undefined,
  limit?: number,
): Promise<SessionSummaryDto[]> {
  const doneSets = sql`from ${s.sessionSets} join ${s.sessionExercises} on ${s.sessionSets.sessionExerciseId} = ${s.sessionExercises.id} where ${s.sessionExercises.sessionId} = ${s.sessions.id} and ${s.sessionSets.done}`;
  const query = db
    .select({
      id: s.sessions.id,
      date: s.sessions.date,
      kind: s.sessions.kind,
      title: s.sessions.title,
      dayName: s.sessions.dayName,
      locationId: s.sessions.locationId,
      startedAt: s.sessions.startedAt,
      finishedAt: s.sessions.finishedAt,
      locationName: s.locations.name,
      cardio: s.cardioEntries,
      exerciseCount: sql<number>`(select count(*) from ${s.sessionExercises} where ${s.sessionExercises.sessionId} = ${s.sessions.id})`,
      doneSetCount: sql<number>`(select count(*) ${doneSets})`,
      volume: sql<number>`(select coalesce(sum(${s.sessionSets.volume}), 0) ${doneSets})`,
    })
    .from(s.sessions)
    .leftJoin(s.locations, eq(s.locations.id, s.sessions.locationId))
    .leftJoin(s.cardioEntries, eq(s.cardioEntries.sessionId, s.sessions.id))
    .where(where)
    .orderBy(desc(s.sessions.date), desc(s.sessions.startedAt))
    .$dynamic();
  const rows = await (limit ? query.limit(limit) : query);
  return rows.map(
    ({
      locationName,
      cardio,
      exerciseCount,
      doneSetCount,
      volume,
      ...session
    }) =>
      toSessionSummaryDto({
        session,
        locationName,
        cardio: toCardio(cardio),
        exerciseCount,
        doneSetCount,
        volume,
      }),
  );
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
  const [session, [location]] = await Promise.all([
    getSession(db, id),
    db
      .select({ name: s.locations.name })
      .from(s.sessions)
      .innerJoin(s.locations, eq(s.locations.id, s.sessions.locationId))
      .where(eq(s.sessions.id, id)),
  ]);
  if (!session) return null;
  const doneSets = session.exercises
    .flatMap((exercise) => exercise.sets)
    .filter((set) => set.done);
  return {
    session,
    locationName: location?.name ?? null,
    doneSetCount: doneSets.length,
    totalVolume:
      Math.round(doneSets.reduce((sum, set) => sum + set.volume, 0) * 100) /
      100,
  };
}

export async function getExerciseHistory(
  db: Database,
  exerciseId: string,
  limit = 30,
): Promise<ExerciseHistoryDto | null> {
  const doneOfExercise = and(
    eq(s.sessionExercises.exerciseId, exerciseId),
    eq(s.sessionSets.done, true),
  );
  const newestSessions = db
    .select({ id: s.sessions.id })
    .from(s.sessions)
    .where(
      sql`exists (select 1 from ${s.sessionExercises} join ${s.sessionSets} on ${s.sessionSets.sessionExerciseId} = ${s.sessionExercises.id} where ${s.sessionExercises.sessionId} = ${s.sessions.id} and ${s.sessionExercises.exerciseId} = ${exerciseId} and ${s.sessionSets.done})`,
    )
    .orderBy(desc(s.sessions.date), desc(s.sessions.startedAt))
    .limit(limit);

  const [[exercise], rows, [best], [anyRow]] = await Promise.all([
    db.select().from(s.exercises).where(eq(s.exercises.id, exerciseId)),
    db
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
      .where(and(doneOfExercise, inArray(s.sessions.id, newestSessions)))
      .orderBy(
        desc(s.sessions.date),
        desc(s.sessions.startedAt),
        asc(s.sessionSets.position),
      ),
    // The best set may be older than the sessions shown.
    db
      .select({
        sessionId: s.sessions.id,
        date: s.sessions.date,
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
      .where(
        and(
          doneOfExercise,
          isNotNull(s.sessionSets.reps),
          gt(s.sessionSets.reps, 0),
          gt(s.sessionSets.volume, 0),
        ),
      )
      .orderBy(
        desc(s.sessionSets.volume),
        desc(s.sessions.date),
        desc(s.sessions.startedAt),
        asc(s.sessionSets.position),
      )
      .limit(1),
    // Name fallback for a deleted exercise whose sets are all older than the page.
    db
      .select({
        name: s.sessionExercises.name,
        loadType: s.sessionExercises.loadType,
      })
      .from(s.sessionSets)
      .innerJoin(
        s.sessionExercises,
        eq(s.sessionExercises.id, s.sessionSets.sessionExerciseId),
      )
      .where(doneOfExercise)
      .limit(1),
  ]);
  if (!exercise && !anyRow) return null;

  const grouped = new Map<string, ExerciseHistoryDto["sessions"][number]>();
  for (const row of rows) {
    let entry = grouped.get(row.sessionId);
    if (!entry) {
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
  }
  const sessions = [...grouped.values()].map((entry) => ({
    ...entry,
    totalVolume: round2(entry.totalVolume),
  }));

  return {
    exerciseId,
    name: exercise?.name ?? rows[0]?.name ?? anyRow?.name ?? "Exercise",
    loadType: (exercise?.loadType ??
      rows[0]?.loadType ??
      anyRow?.loadType ??
      "total") as LoadType,
    sessions,
    bestSet: best
      ? {
          sessionId: best.sessionId,
          date: best.date,
          weight: best.weight,
          reps: best.reps!,
          volume: best.volume,
        }
      : null,
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
      totalVolume: round2(total),
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
