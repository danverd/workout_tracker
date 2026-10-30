// @vitest-environment node
import { randomUUID } from "node:crypto";
import { beforeAll, describe, expect, it } from "vitest";
import { createTestDb, type Database } from "@/db/client";
import * as s from "@/db/schema";
import {
  getExerciseHistory,
  getSessionDetail,
  getSummary,
  getTodayData,
  listHistory,
  listTodaySessions,
} from "@/db/queries/history";
import { upsertCardio } from "@/db/queries/cardio";
import { insertStrength } from "./helpers";

let db: Database;
const NOW = new Date("2026-10-30T15:00:00Z");
const hoursAgo = (h: number) => new Date(NOW.getTime() - h * 3_600_000);
const done = (weight: number, reps: number) => ({ weight, reps, done: true });
const open = (weight: number) => ({ weight, reps: null, done: false });

beforeAll(async () => {
  db = await createTestDb();
}, 60_000);

describe("today", () => {
  it("lists every session on the date with done counts and volume", async () => {
    const date = "2026-03-02";
    const morning = await insertStrength(db, {
      date,
      startedAt: new Date("2026-03-02T13:00:00Z"),
      exercises: [{ sets: [done(100, 10), open(100)] }],
    });
    await upsertCardio(
      db,
      {
        id: randomUUID(),
        date,
        locationId: null,
        activity: "Walk",
        durationSec: 1800,
        distance: null,
        distanceUnit: null,
        notes: "",
      },
      date,
    );
    await insertStrength(db, { date: "2026-03-03" });

    const sessions = await listTodaySessions(db, date);
    expect(sessions).toHaveLength(2);
    const strength = sessions.find((x) => x.id === morning)!;
    expect(strength).toMatchObject({
      doneSetCount: 1,
      totalVolume: 1000,
      exerciseCount: 1,
      finishedAt: null,
    });
    expect(sessions.find((x) => x.kind === "cardio")?.cardio?.activity).toBe(
      "Walk",
    );
    const data = await getTodayData(db, date);
    expect(data.sessions).toHaveLength(2);
    expect(data.hasExercises).toBe(false);
  });
});

describe("history list", () => {
  it("hides empty strength sessions older than 24h but keeps recent ones", async () => {
    const old = await insertStrength(db, {
      date: "2026-01-10",
      startedAt: hoursAgo(30),
    });
    const recent = await insertStrength(db, {
      date: "2026-01-11",
      startedAt: hoursAgo(2),
    });
    const withSets = await insertStrength(db, {
      date: "2026-01-09",
      startedAt: hoursAgo(80),
      exercises: [{ sets: [done(50, 5)] }],
    });
    const ids = (
      await listHistory(db, { before: "2026-02-01" }, NOW)
    ).sessions.map((x) => x.id);
    expect(ids).toContain(recent);
    expect(ids).toContain(withSets);
    expect(ids).not.toContain(old);
    expect(ids.indexOf(recent)).toBeLessThan(ids.indexOf(withSets));
  });

  it("pages by date without splitting a day", async () => {
    for (const date of ["2025-05-03", "2025-05-03", "2025-05-02", "2025-05-01"])
      await insertStrength(db, {
        date,
        startedAt: hoursAgo(5000),
        exercises: [{ sets: [done(10, 10)] }],
      });
    const first = await listHistory(
      db,
      { before: "2025-06-01", limit: 1 },
      NOW,
    );
    expect(first.sessions.map((x) => x.date)).toEqual([
      "2025-05-03",
      "2025-05-03",
    ]);
    expect(first.nextCursor).toBe("2025-05-03");
    const second = await listHistory(
      db,
      { before: first.nextCursor!, limit: 5 },
      NOW,
    );
    expect(second.sessions.map((x) => x.date)).toEqual([
      "2025-05-02",
      "2025-05-01",
    ]);
    expect(second.nextCursor).toBeNull();
  });
});

describe("summary", () => {
  it("counts only done sets, includes unfinished sessions and cardio", async () => {
    // Week of Mon 2024-06-03 .. Sun 2024-06-09
    await insertStrength(db, {
      date: "2024-06-03",
      finishedAt: new Date(),
      exercises: [{ sets: [done(100, 10), open(100)] }],
    });
    await insertStrength(db, {
      date: "2024-06-05",
      finishedAt: null, // never finished, still counts
      exercises: [{ sets: [done(50, 10)] }],
    });
    await insertStrength(db, {
      date: "2024-06-06",
      exercises: [{ sets: [open(300)] }], // no done sets: not counted
    });
    await insertStrength(db, {
      date: "2024-05-30", // previous week
      exercises: [{ sets: [done(10, 10)] }],
    });
    await upsertCardio(
      db,
      {
        id: randomUUID(),
        date: "2024-06-04",
        locationId: null,
        activity: "Row",
        durationSec: 600,
        distance: null,
        distanceUnit: null,
        notes: "",
      },
      "2024-06-04",
    );

    const week = await getSummary(db, { period: "week", anchor: "2024-06-07" });
    expect(week.current).toMatchObject({
      start: "2024-06-03",
      end: "2024-06-09",
      totalVolume: 1500,
      strengthCount: 2,
      cardioCount: 1,
      sessionCount: 3,
    });
    expect(week.sessions).toHaveLength(3);

    const weeks = await getSummary(db, {
      period: "week",
      anchor: "2024-06-07",
      count: 2,
    });
    expect(weeks.periods.map((p) => p.totalVolume)).toEqual([1500, 100]);

    const month = await getSummary(db, {
      period: "month",
      anchor: "2024-06-07",
    });
    expect(month.current.start).toBe("2024-06-01");
    expect(month.current.totalVolume).toBe(1500);
  });
});

describe("exercise history", () => {
  it("returns done sets per session and the highest-volume set", async () => {
    const [ex] = await db
      .insert(s.exercises)
      .values({ id: randomUUID(), name: "Test press", loadType: "per_hand" })
      .returning();
    await insertStrength(db, {
      date: "2023-02-01",
      exercises: [
        {
          exerciseId: ex.id,
          name: "Test press",
          loadType: "per_hand",
          sets: [done(40, 10), done(50, 8), open(60)],
        },
      ],
    });
    await insertStrength(db, {
      date: "2023-02-08",
      exercises: [
        {
          exerciseId: ex.id,
          name: "Test press",
          loadType: "per_hand",
          sets: [done(45, 12)],
        },
      ],
    });
    const history = await getExerciseHistory(db, ex.id);
    expect(history?.name).toBe("Test press");
    expect(history?.sessions.map((x) => x.date)).toEqual([
      "2023-02-08",
      "2023-02-01",
    ]);
    expect(history?.sessions[1].sets).toHaveLength(2);
    expect(history?.sessions[1].totalVolume).toBe(1600);
    // 45 x2 x12 = 1080 beats 50 x2 x8 = 800 and 40 x2 x10 = 800
    expect(history?.bestSet).toMatchObject({
      date: "2023-02-08",
      weight: 45,
      reps: 12,
      volume: 1080,
    });
    expect(await getExerciseHistory(db, randomUUID())).toBeNull();
  });

  it("respects limit but still finds a best set older than the page", async () => {
    const [ex] = await db
      .insert(s.exercises)
      .values({ id: randomUUID(), name: "Limit press", loadType: "total" })
      .returning();
    const dates = ["2022-01-01", "2022-01-08", "2022-01-15", "2022-01-22"];
    for (const [index, date] of dates.entries())
      await insertStrength(db, {
        date,
        exercises: [
          {
            exerciseId: ex.id,
            sets: [done(index === 0 ? 300 : 100, 5)],
          },
        ],
      });
    const history = await getExerciseHistory(db, ex.id, 2);
    expect(history?.sessions.map((x) => x.date)).toEqual([
      "2022-01-22",
      "2022-01-15",
    ]);
    expect(history?.bestSet).toMatchObject({ date: "2022-01-01", weight: 300 });
  });

  it("session detail returns exercises and sets", async () => {
    const id = await insertStrength(db, {
      date: "2022-01-01",
      exercises: [{ sets: [done(10, 10), open(10)] }],
    });
    const detail = await getSessionDetail(db, id);
    expect(detail?.session.exercises[0].sets).toHaveLength(2);
    expect(await getSessionDetail(db, randomUUID())).toBeNull();
  });
});
