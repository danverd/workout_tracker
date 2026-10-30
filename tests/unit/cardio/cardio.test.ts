// @vitest-environment node
import { randomUUID } from "node:crypto";
import { beforeAll, describe, expect, it } from "vitest";
import { count } from "drizzle-orm";
import { createTestDb, type Database } from "@/db/client";
import * as s from "@/db/schema";
import {
  CardioConflictError,
  deleteCardio,
  recentActivities,
  upsertCardio,
} from "@/db/queries/cardio";
import { insertStrength } from "../history/helpers";

let db: Database;
beforeAll(async () => {
  db = await createTestDb();
}, 60_000);

const base = (id: string) => ({
  id,
  locationId: null,
  activity: "Walk",
  durationSec: 1800,
  distance: 2.5,
  distanceUnit: "mi" as const,
  notes: "",
});

describe("cardio", () => {
  it("upserts idempotently and updates in place", async () => {
    const id = randomUUID();
    const first = await upsertCardio(db, base(id), "2026-10-30");
    expect(first).toMatchObject({ kind: "cardio", date: "2026-10-30" });
    expect(first.cardio).toMatchObject({ activity: "Walk", distance: 2.5 });

    await upsertCardio(db, base(id), "2026-10-30");
    const updated = await upsertCardio(
      db,
      {
        ...base(id),
        activity: "Treadmill",
        distance: null,
        distanceUnit: null,
      },
      "2026-10-30",
    );
    expect(updated.cardio).toMatchObject({
      activity: "Treadmill",
      distance: null,
      distanceUnit: null,
    });
    const [sessions] = await db.select({ n: count() }).from(s.sessions);
    const [entries] = await db.select({ n: count() }).from(s.cardioEntries);
    expect(sessions.n).toBe(1);
    expect(entries.n).toBe(1);
  });

  it("rejects ids that belong to strength sessions", async () => {
    const strength = await insertStrength(db, { date: "2026-10-30" });
    await expect(upsertCardio(db, base(strength))).rejects.toBeInstanceOf(
      CardioConflictError,
    );
  });

  it("lists recent activities and deletes only cardio", async () => {
    const id = randomUUID();
    await upsertCardio(db, { ...base(id), activity: "Row" });
    expect((await recentActivities(db))[0]).toBe("Row");
    const strength = await insertStrength(db, { date: "2026-10-30" });
    expect(await deleteCardio(db, strength)).toBe(false);
    expect(await deleteCardio(db, id)).toBe(true);
    expect(await deleteCardio(db, id)).toBe(false);
    const [entries] = await db
      .select({ n: count() })
      .from(s.cardioEntries)
      .where(
        // cascade removed the entry for the deleted session
        undefined,
      );
    expect(entries.n).toBe(1); // the earlier Walk/Treadmill entry remains
  });
});
