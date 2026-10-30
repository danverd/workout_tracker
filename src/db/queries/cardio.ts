import { and, desc, eq, sql } from "drizzle-orm";
import type { Database } from "@/db/client";
import * as s from "@/db/schema";
import { getSessionDetail } from "@/db/queries/history";
import { todayInAppTimeZone } from "@/lib/dates";
import type { CardioInput } from "@/lib/validation/sessions";
import type { SessionDto } from "@/types/domain";

export class CardioConflictError extends Error {}

/**
 * Idempotent create/update keyed by the client id. Replaying the same
 * payload changes nothing; an id that belongs to a strength session is rejected.
 */
export async function upsertCardio(
  db: Database,
  input: CardioInput,
  today = todayInAppTimeZone(),
): Promise<SessionDto> {
  await db.transaction(async (tx) => {
    const [existing] = await tx
      .select({ kind: s.sessions.kind })
      .from(s.sessions)
      .where(eq(s.sessions.id, input.id));
    if (existing && existing.kind !== "cardio")
      throw new CardioConflictError("That id belongs to a strength session.");

    const startedAt = input.startedAt ? new Date(input.startedAt) : new Date();
    const header = {
      date: input.date ?? today,
      locationId: input.locationId,
      title: input.activity,
      notes: input.notes,
    };
    await tx
      .insert(s.sessions)
      .values({
        id: input.id,
        kind: "cardio",
        ...header,
        startedAt,
        finishedAt: startedAt,
      })
      .onConflictDoUpdate({ target: s.sessions.id, set: header });

    const entry = {
      activity: input.activity,
      durationSec: input.durationSec,
      distance: input.distance,
      distanceUnit: input.distance === null ? null : input.distanceUnit,
    };
    await tx
      .insert(s.cardioEntries)
      .values({ sessionId: input.id, ...entry })
      .onConflictDoUpdate({ target: s.cardioEntries.sessionId, set: entry });
  });
  const detail = await getSessionDetail(db, input.id);
  return detail!.session;
}

/** Returns false when no cardio session has that id. */
export async function deleteCardio(db: Database, id: string) {
  const deleted = await db
    .delete(s.sessions)
    .where(and(eq(s.sessions.id, id), eq(s.sessions.kind, "cardio")))
    .returning({ id: s.sessions.id });
  return deleted.length > 0;
}

/** Most recently used activities first. */
export async function recentActivities(db: Database, limit = 6) {
  const rows = await db
    .select({ activity: s.cardioEntries.activity })
    .from(s.cardioEntries)
    .innerJoin(s.sessions, eq(s.sessions.id, s.cardioEntries.sessionId))
    .groupBy(s.cardioEntries.activity)
    .orderBy(desc(sql`max(${s.sessions.startedAt})`))
    .limit(limit);
  return rows.map((row) => row.activity);
}
