// @vitest-environment node
import { randomUUID } from "node:crypto";
import { beforeAll, describe, expect, it } from "vitest";
import { createTestDb, type Database } from "@/db/client";
import { createSession, loadCatalog } from "@/db/queries/sessions";
import { seedDatabase } from "@/db/seed";
import {
  formatLast,
  formatTarget,
  lastRepsAt,
  newId,
  targetReps,
  type Catalog,
} from "@/features/session/catalog";
import {
  buildCreateInput,
  buildPreviewItems,
  defaultDayChoice,
  defaultLocationId,
  parseDayChoice,
  suggestionsFor,
} from "@/features/session/preview";
import { sessionCreateSchema } from "@/lib/validation/sessions";

let db: Database;
let catalog: Catalog;
let home: string;
let gym: string;
const exerciseId = (name: string) =>
  catalog.exercises.find((e) => e.name === name)!.id;
const nameOf = (id: string | null) =>
  catalog.exercises.find((e) => e.id === id)?.name ?? null;

beforeAll(async () => {
  db = await createTestDb();
  await seedDatabase(db);
  catalog = await loadCatalog(db);
  home = catalog.locations.find((l) => l.name === "Home")!.id;
  gym = catalog.locations.find((l) => l.name !== "Home")!.id;
}, 60_000);

function pushDay() {
  const choice = defaultDayChoice(catalog);
  return parseDayChoice(catalog, choice)!;
}

describe("defaults", () => {
  it("preselects the last location and the active program's next day", () => {
    expect(defaultLocationId(catalog)).toBe(home);
    const { program, day } = pushDay();
    expect(program.name).toBe("Push / Pull / Legs");
    expect(day.name).toBe("Push");
  });

  it("falls back to the first location and freestyle", () => {
    const bare: Catalog = {
      ...catalog,
      settings: {
        ...catalog.settings,
        lastLocationId: null,
        activeProgramId: null,
      },
    };
    expect(defaultLocationId(bare)).toBe(bare.locations[0].id);
    expect(defaultDayChoice(bare)).toBe("freestyle");
    expect(parseDayChoice(bare, "freestyle")).toBeNull();
  });
});

describe("buildPreviewItems", () => {
  it("resolves the Push day at home and flags what cannot be done there", () => {
    const items = buildPreviewItems(catalog, home, pushDay().day);
    expect(items.map((i) => [nameOf(i.exerciseId), i.status])).toEqual([
      ["Incline dumbbell press", "resolved"], // horizontal press
      ["Seated dumbbell shoulder press", "resolved"], // vertical press
      [null, "unavailable"], // dips: no dip station at home
      [null, "choose"], // triceps: nothing available at home
    ]);
    expect(items[0]).toMatchObject({
      sets: 4,
      target: { repMin: 6, repMax: 10 },
    });
    expect(items[0].candidateIds).toEqual([
      exerciseId("Incline dumbbell press"),
    ]);
  });

  it("resolves the same day differently at the gym", () => {
    const items = buildPreviewItems(catalog, gym, pushDay().day);
    expect(nameOf(items[0].exerciseId)).toBe("Barbell bench press");
    expect(items[0].candidateIds.map(nameOf)).toEqual([
      "Barbell bench press",
      "Cable chest press",
      "Incline dumbbell press",
    ]);
    expect(nameOf(items[2].exerciseId)).toBe("Dips");
    expect(nameOf(items[3].exerciseId)).toBe("Cable triceps pushdown");
  });

  it("returns nothing for freestyle", () => {
    expect(buildPreviewItems(catalog, home, null)).toEqual([]);
  });

  it("prefers what was last used at this location", async () => {
    const rowId = randomUUID();
    await createSession(
      db,
      sessionCreateSchema.parse({
        id: randomUUID(),
        locationId: gym,
        startedAt: "2026-10-01T10:00:00.000Z",
        date: "2026-10-01",
        exercises: [
          {
            id: rowId,
            exerciseId: exerciseId("Incline dumbbell press"),
            position: 0,
            sets: [
              {
                id: randomUUID(),
                position: 0,
                weight: 85,
                reps: 10,
                done: true,
              },
              {
                id: randomUUID(),
                position: 1,
                weight: 85,
                reps: 8,
                done: true,
              },
            ],
          },
        ],
      }),
    );
    catalog = await loadCatalog(db);
    const items = buildPreviewItems(catalog, gym, pushDay().day);
    expect(nameOf(items[0].exerciseId)).toBe("Incline dumbbell press");
  });
});

describe("suggestionsFor", () => {
  it("snaps last time's gym weight to the home dumbbells", () => {
    const id = exerciseId("Incline dumbbell press");
    // Last time: 85 lb at the gym. Home dumbbells top out at 80.
    expect(suggestionsFor(catalog, home, id, 3).map((x) => x.weight)).toEqual([
      80, 80, 80,
    ]);
    expect(suggestionsFor(catalog, gym, id, 2).map((x) => x.weight)).toEqual([
      85, 85,
    ]);
    expect(suggestionsFor(catalog, gym, id, 2).map((x) => x.lastReps)).toEqual([
      10, 8,
    ]);
  });

  it("leaves weight blank for an exercise never done", () => {
    expect(
      suggestionsFor(catalog, home, exerciseId("Dips"), 2).map((x) => x.weight),
    ).toEqual([null, null]);
  });
});

describe("buildCreateInput", () => {
  it("builds a valid payload with client ids, skipping unresolved lines", () => {
    const { program, day } = pushDay();
    const items = buildPreviewItems(catalog, home, day);
    const input = buildCreateInput({
      catalog,
      sessionId: newId(),
      locationId: home,
      program,
      day,
      items,
    });
    expect(sessionCreateSchema.safeParse(input).success).toBe(true);
    expect(input.title).toBe("Push / Pull / Legs");
    expect(input.dayName).toBe("Push");
    expect(input.programDayId).toBe(day.id);
    expect(input.exercises).toHaveLength(2);
    expect(input.exercises.map((e) => e.position)).toEqual([0, 1]);
    expect(input.exercises[0].sets).toHaveLength(4);
    expect(input.exercises[0].sets[0]).toMatchObject({
      weight: 80,
      reps: null,
      done: false,
    });
    expect(input.exercises[0].slotId).toBe(day.slots[0].id);
    const ids = input.exercises.flatMap((e) => [
      e.id,
      ...e.sets.map((x) => x.id),
    ]);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("builds a freestyle payload", () => {
    const input = buildCreateInput({
      catalog,
      sessionId: newId(),
      locationId: home,
      program: null,
      day: null,
      items: [],
    });
    expect(input).toMatchObject({
      programId: null,
      programDayId: null,
      title: "Freestyle",
      exercises: [],
    });
  });
});

describe("formatting helpers", () => {
  it("formats targets", () => {
    const base = { sets: 3, repMin: 8, repMax: 12, amrap: false };
    expect(formatTarget(base)).toBe("3 × 8–12");
    expect(formatTarget({ ...base, repMin: 10, repMax: 10 })).toBe("3 × 10");
    expect(formatTarget({ ...base, amrap: true })).toBe("3 × AMRAP");
    expect(formatTarget({ ...base, repMin: null, repMax: null })).toBe(
      "3 sets",
    );
    expect(formatTarget(null, 4)).toBe("4 sets");
    expect(formatTarget(base, 5)).toBe("5 × 8–12");
  });

  it("formats last time and finds default reps", () => {
    const last = [
      { position: 1, weight: 50, reps: 9 },
      { position: 0, weight: 50, reps: 10 },
    ];
    expect(formatLast(last)).toBe("last: 50 × 10, 50 × 9");
    expect(formatLast([])).toBe("");
    expect(lastRepsAt(last, 0)).toBe(10);
    expect(lastRepsAt(last, 5)).toBe(9);
    expect(lastRepsAt(undefined, 0)).toBeNull();
    expect(targetReps({ sets: 3, repMin: 8, repMax: 12, amrap: false })).toBe(
      8,
    );
    expect(targetReps(null)).toBeNull();
  });
});
