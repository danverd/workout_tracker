// @vitest-environment node
import { randomUUID } from "node:crypto";
import { count, eq } from "drizzle-orm";
import { beforeAll, describe, expect, it } from "vitest";
import { createTestDb, type Database } from "@/db/client";
import * as s from "@/db/schema";
import { seedDatabase } from "@/db/seed";
import { setVolume } from "@/lib/domain/volume";

let db: Database;

beforeAll(async () => {
  db = await createTestDb();
}, 60_000);

describe("migrations + seed on in-memory PGlite", () => {
  it("seeds sample data once", async () => {
    expect(await seedDatabase(db)).toBe(true);
    expect(await seedDatabase(db)).toBe(false);

    const [locations] = await db.select({ n: count() }).from(s.locations);
    const [equipment] = await db.select({ n: count() }).from(s.equipment);
    const [movements] = await db.select({ n: count() }).from(s.movements);
    const [exercises] = await db.select({ n: count() }).from(s.exercises);
    expect(locations.n).toBe(2);
    expect(equipment.n).toBeGreaterThanOrEqual(10);
    expect(movements.n).toBe(8);
    expect(exercises.n).toBeGreaterThanOrEqual(15);

    const loadTypes = await db
      .selectDistinct({ loadType: s.exercises.loadType })
      .from(s.exercises);
    expect(loadTypes.map((row) => row.loadType).sort()).toEqual([
      "assisted",
      "bodyweight",
      "per_hand",
      "per_side",
      "total",
    ]);
  });

  it("stores home dumbbell weights 5-80 by 5", async () => {
    const [home] = await db
      .select()
      .from(s.locations)
      .where(eq(s.locations.name, "Home"));
    const [dumbbells] = await db
      .select()
      .from(s.equipment)
      .where(eq(s.equipment.name, "Dumbbells"));
    const [row] = await db
      .select()
      .from(s.locationEquipment)
      .where(eq(s.locationEquipment.locationId, home.id));
    expect(row.equipmentId).toBeDefined();
    const rows = await db.select().from(s.locationEquipment);
    const homeDumbbells = rows.find(
      (r) => r.locationId === home.id && r.equipmentId === dumbbells.id,
    );
    expect(homeDumbbells?.weights).toHaveLength(16);
    expect(homeDumbbells?.weights?.[0]).toBe(5);
    expect(homeDumbbells?.weights?.at(-1)).toBe(80);
  });

  it("creates the PPL program with ordered days and slots", async () => {
    const days = await db.select().from(s.programDays);
    expect(days.map((d) => d.name).sort()).toEqual(["Legs", "Pull", "Push"]);
    const [slots] = await db.select({ n: count() }).from(s.programSlots);
    expect(slots.n).toBeGreaterThanOrEqual(10);
    const [settings] = await db.select().from(s.settings);
    expect(settings.id).toBe(1);
    expect(settings.bodyweightLb).toBe(180);
    expect(settings.activeProgramId).not.toBeNull();
  });

  it("stores a client-id session with sets and keeps history on day delete", async () => {
    const [day] = await db.select().from(s.programDays).limit(1);
    const [exercise] = await db.select().from(s.exercises).limit(1);
    const sessionId = randomUUID();
    const exerciseId = randomUUID();
    const setId = randomUUID();
    await db.insert(s.sessions).values({
      id: sessionId,
      date: "2026-10-30",
      kind: "strength",
      programId: day.programId,
      programDayId: day.id,
      dayName: day.name,
      bodyweightLb: 180,
    });
    await db.insert(s.sessionExercises).values({
      id: exerciseId,
      sessionId,
      exerciseId: exercise.id,
      position: 0,
      name: exercise.name,
      loadType: exercise.loadType,
      baseWeight: exercise.baseWeight,
    });
    const volume = setVolume({
      loadType: "per_hand",
      weight: 50,
      baseWeight: 0,
      bodyweightLb: 180,
      reps: 10,
      done: true,
    });
    await db.insert(s.sessionSets).values({
      id: setId,
      sessionExerciseId: exerciseId,
      position: 0,
      weight: 50,
      reps: 10,
      done: true,
      volume,
    });

    await db.delete(s.programDays).where(eq(s.programDays.id, day.id));
    const [session] = await db
      .select()
      .from(s.sessions)
      .where(eq(s.sessions.id, sessionId));
    expect(session.programDayId).toBeNull();
    expect(session.dayName).toBe(day.name);
  });

  it("enforces check constraints", async () => {
    await expect(
      db.insert(s.sessions).values({
        id: randomUUID(),
        date: "2026-10-30",
        kind: "swim",
      }),
    ).rejects.toThrow();
    await expect(
      db.insert(s.settings).values({ id: 2, bodyweightLb: 100 }),
    ).rejects.toThrow();
    await expect(
      db.insert(s.exercises).values({ name: "Bad", loadType: "wrong" }),
    ).rejects.toThrow();
  });
});
