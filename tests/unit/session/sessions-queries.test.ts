// @vitest-environment node
import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import { beforeAll, beforeEach, describe, expect, it } from "vitest";
import { createTestDb, type Database } from "@/db/client";
import {
  createSession,
  deleteSessionExercise,
  deleteSet,
  finishSession,
  getSession,
  loadCatalog,
  patchSession,
  reopenSession,
  SessionQueryError,
  upsertSessionExercise,
  upsertSet,
} from "@/db/queries/sessions";
import * as s from "@/db/schema";
import { seedDatabase } from "@/db/seed";
import { todayInAppTimeZone } from "@/lib/dates";
import { sessionCreateSchema } from "@/lib/validation/sessions";

let db: Database;
let ids: {
  home: string;
  gym: string;
  program: string;
  push: string;
  pull: string;
  legs: string;
  exercise: Record<string, string>;
};

beforeAll(async () => {
  db = await createTestDb();
  await seedDatabase(db);
  const locations = await db.select().from(s.locations);
  const exercises = await db.select().from(s.exercises);
  const [program] = await db.select().from(s.programs);
  const days = await db.select().from(s.programDays);
  ids = {
    home: locations.find((l) => l.name === "Home")!.id,
    gym: locations.find((l) => l.name !== "Home")!.id,
    program: program.id,
    push: days.find((d) => d.name === "Push")!.id,
    pull: days.find((d) => d.name === "Pull")!.id,
    legs: days.find((d) => d.name === "Legs")!.id,
    exercise: Object.fromEntries(exercises.map((e) => [e.name, e.id])),
  };
}, 60_000);

// One migrated database for the file; each test starts from the seed state.
beforeEach(async () => {
  await db.delete(s.sessions);
  await db.update(s.exercises).set({ archivedAt: null });
  await db.update(s.locations).set({ archivedAt: null });
  await db
    .update(s.settings)
    .set({ bodyweightLb: 180, lastLocationId: ids.home });
  for (const [name, loadType] of [["Incline dumbbell press", "per_hand"]])
    await db
      .update(s.exercises)
      .set({ name, loadType })
      .where(eq(s.exercises.id, ids.exercise[name]));
});

const set = (
  position: number,
  weight: number,
  reps: number | null,
  done = true,
) => ({
  id: randomUUID(),
  position,
  weight,
  reps,
  done,
});

function startInput(overrides: Record<string, unknown> = {}) {
  const exerciseId = randomUUID();
  return {
    exerciseRowId: exerciseId,
    input: sessionCreateSchema.parse({
      id: randomUUID(),
      locationId: ids.home,
      programId: ids.program,
      programDayId: ids.push,
      title: "Push / Pull / Legs",
      dayName: "Push",
      exercises: [
        {
          id: exerciseId,
          exerciseId: ids.exercise["Incline dumbbell press"],
          slotId: null,
          position: 0,
          sets: [set(0, 50, 10), set(1, 50, null, false)],
        },
      ],
      ...overrides,
    }),
  };
}

describe("createSession", () => {
  it("snapshots exercise and bodyweight, dates today, remembers the location", async () => {
    await db
      .update(s.settings)
      .set({ lastLocationId: ids.home, bodyweightLb: 181 });
    const { input } = startInput({ locationId: ids.gym });
    const created = await createSession(db, input);

    expect(created.date).toBe(todayInAppTimeZone());
    expect(created.kind).toBe("strength");
    expect(created.bodyweightLb).toBe(181);
    expect(created.title).toBe("Push / Pull / Legs");
    expect(created.dayName).toBe("Push");
    expect(created.finishedAt).toBeNull();
    expect(created.exercises).toHaveLength(1);
    expect(created.exercises[0]).toMatchObject({
      name: "Incline dumbbell press",
      loadType: "per_hand",
      baseWeight: 0,
    });
    expect(created.exercises[0].sets.map((x) => x.position)).toEqual([0, 1]);

    const [settings] = await db.select().from(s.settings);
    expect(settings.lastLocationId).toBe(ids.gym);
  });

  it("is idempotent and keeps snapshots when the exercise is edited later", async () => {
    const { input } = startInput();
    await createSession(db, input);
    await db
      .update(s.exercises)
      .set({ name: "Renamed press", loadType: "total" })
      .where(eq(s.exercises.id, ids.exercise["Incline dumbbell press"]));
    await db.update(s.settings).set({ bodyweightLb: 999 });

    const again = await createSession(db, input);
    expect(again.exercises).toHaveLength(1);
    expect(again.exercises[0].sets).toHaveLength(2);
    expect(again.exercises[0].name).toBe("Incline dumbbell press");
    expect(again.exercises[0].loadType).toBe("per_hand");
    expect(again.bodyweightLb).toBe(180);
    expect(await db.select().from(s.sessions)).toHaveLength(1);
  });

  it("rejects an unknown location or exercise", async () => {
    await expect(
      createSession(db, startInput({ locationId: randomUUID() }).input),
    ).rejects.toMatchObject({ status: 404 });
    const bad = startInput().input;
    bad.exercises[0].exerciseId = randomUUID();
    await expect(createSession(db, bad)).rejects.toBeInstanceOf(
      SessionQueryError,
    );
    // The transaction rolled back: no half-created session.
    expect(await db.select().from(s.sessions)).toHaveLength(0);
  });

  it("drops a program slot that no longer exists", async () => {
    const { input } = startInput();
    input.exercises[0].slotId = randomUUID();
    const created = await createSession(db, input);
    expect(created.exercises[0].slotId).toBeNull();
  });
});

describe("upserts and deletes", () => {
  it("upserting a set twice leaves one row; the second write wins", async () => {
    const { input, exerciseRowId } = startInput();
    const created = await createSession(db, input);
    const target = created.exercises[0].sets[1];
    const edit = {
      id: target.id,
      position: 1,
      weight: 55,
      reps: 9,
      done: true,
    };

    await upsertSet(db, input.id, exerciseRowId, edit);
    const final = await upsertSet(db, input.id, exerciseRowId, edit);
    expect(final).toMatchObject({ weight: 55, reps: 9, done: true });
    const session = await getSession(db, input.id);
    expect(session?.exercises[0].sets).toHaveLength(2);
  });

  it("adds a set from the client id and keeps exercise snapshots on re-upsert", async () => {
    const { input, exerciseRowId } = startInput();
    await createSession(db, input);
    await upsertSessionExercise(db, input.id, {
      id: exerciseRowId,
      exerciseId: ids.exercise["Dips"], // ignored: the row already exists
      slotId: null,
      position: 3,
    });
    const session = await getSession(db, input.id);
    expect(session?.exercises[0]).toMatchObject({
      name: "Incline dumbbell press",
      position: 3,
      exerciseId: ids.exercise["Incline dumbbell press"],
    });
  });

  it("404s a set for an exercise that is not in the session", async () => {
    const { input } = startInput();
    await createSession(db, input);
    await expect(
      upsertSet(db, input.id, randomUUID(), set(0, 1, 1)),
    ).rejects.toMatchObject({ status: 404 });
  });

  it("409s when ids belong elsewhere", async () => {
    const a = startInput();
    const b = startInput();
    await createSession(db, a.input);
    await createSession(db, b.input);
    await expect(
      upsertSessionExercise(db, b.input.id, {
        id: a.exerciseRowId,
        exerciseId: ids.exercise["Dips"],
        slotId: null,
        position: 0,
      }),
    ).rejects.toMatchObject({ status: 409 });
    const aSet = a.input.exercises[0].sets[0];
    await expect(
      upsertSet(db, b.input.id, b.exerciseRowId, aSet),
    ).rejects.toMatchObject({ status: 409 });
  });

  it("deletes sets and exercises idempotently, cascading sets", async () => {
    const { input, exerciseRowId } = startInput();
    await createSession(db, input);
    const [first, second] = input.exercises[0].sets;
    await deleteSet(db, input.id, exerciseRowId, first.id);
    await deleteSet(db, input.id, exerciseRowId, first.id);
    // A mismatched exercise id deletes nothing.
    await deleteSet(db, input.id, randomUUID(), second.id);
    expect((await getSession(db, input.id))?.exercises[0].sets).toHaveLength(1);

    await deleteSessionExercise(db, input.id, exerciseRowId);
    await deleteSessionExercise(db, input.id, exerciseRowId);
    expect((await getSession(db, input.id))?.exercises).toHaveLength(0);
    expect(await db.select().from(s.sessionSets)).toHaveLength(0);
  });
});

describe("server-side volume", () => {
  async function volumeFor(
    exerciseName: string,
    entry: { weight: number; reps: number | null; done: boolean },
    bodyweight = 180,
  ) {
    await db.update(s.settings).set({ bodyweightLb: bodyweight });
    const rowId = randomUUID();
    const sessionId = randomUUID();
    await createSession(
      db,
      sessionCreateSchema.parse({
        id: sessionId,
        locationId: ids.gym,
        exercises: [
          {
            id: rowId,
            exerciseId: ids.exercise[exerciseName],
            position: 0,
          },
        ],
      }),
    );
    const saved = await upsertSet(db, sessionId, rowId, {
      id: randomUUID(),
      position: 0,
      ...entry,
    });
    return saved.volume;
  }

  it("per_hand doubles the entered weight", async () => {
    expect(
      await volumeFor("Incline dumbbell press", {
        weight: 50,
        reps: 10,
        done: true,
      }),
    ).toBe(1000);
  });

  it("per_side adds the snapshotted base", async () => {
    expect(
      await volumeFor("Barbell bench press", {
        weight: 45,
        reps: 5,
        done: true,
      }),
    ).toBe((45 + 90) * 5);
  });

  it("total uses the weight as entered", async () => {
    expect(
      await volumeFor("Lat pulldown", { weight: 100, reps: 10, done: true }),
    ).toBe(1000);
  });

  it("assisted subtracts from the session bodyweight", async () => {
    expect(
      await volumeFor(
        "Assisted pull-up",
        { weight: 60, reps: 8, done: true },
        200,
      ),
    ).toBe(140 * 8);
  });

  it("bodyweight adds to the session bodyweight", async () => {
    expect(
      await volumeFor("Pull-up", { weight: 10, reps: 5, done: true }, 180),
    ).toBe(190 * 5);
  });

  it("counts only done sets with reps", async () => {
    expect(
      await volumeFor("Incline dumbbell press", {
        weight: 50,
        reps: 10,
        done: false,
      }),
    ).toBe(0);
    expect(
      await volumeFor("Incline dumbbell press", {
        weight: 50,
        reps: null,
        done: true,
      }),
    ).toBe(0);
  });

  it("recomputes when a set is un-done", async () => {
    const { input, exerciseRowId } = startInput();
    const created = await createSession(db, input);
    const done = created.exercises[0].sets[0];
    expect(done.volume).toBe(1000);
    const undone = await upsertSet(db, input.id, exerciseRowId, {
      id: done.id,
      position: 0,
      weight: 50,
      reps: 10,
      done: false,
    });
    expect(undone.volume).toBe(0);
  });

  it("uses the snapshot bodyweight, not the current setting", async () => {
    const rowId = randomUUID();
    const sessionId = randomUUID();
    await db.update(s.settings).set({ bodyweightLb: 180 });
    await createSession(
      db,
      sessionCreateSchema.parse({
        id: sessionId,
        exercises: [
          { id: rowId, exerciseId: ids.exercise["Pull-up"], position: 0 },
        ],
      }),
    );
    await db.update(s.settings).set({ bodyweightLb: 250 });
    const saved = await upsertSet(db, sessionId, rowId, {
      id: randomUUID(),
      position: 0,
      weight: 0,
      reps: 10,
      done: true,
    });
    expect(saved.volume).toBe(1800);
  });
});

describe("header, finish and reopen", () => {
  it("patches the header and updates the last location", async () => {
    const { input } = startInput();
    await createSession(db, input);
    const patched = await patchSession(db, input.id, {
      locationId: ids.gym,
      notes: "Shoulder felt tight",
    });
    expect(patched).toMatchObject({
      locationId: ids.gym,
      notes: "Shoulder felt tight",
    });
    const [settings] = await db.select().from(s.settings);
    expect(settings.lastLocationId).toBe(ids.gym);
    await expect(
      patchSession(db, randomUUID(), { notes: "x" }),
    ).rejects.toMatchObject({ status: 404 });
    await expect(
      patchSession(db, input.id, { locationId: randomUUID() }),
    ).rejects.toMatchObject({ status: 404 });
  });

  it("finishes idempotently and reopens", async () => {
    const { input } = startInput();
    await createSession(db, input);
    const at = "2026-10-30T15:00:00.000Z";
    const finished = await finishSession(db, input.id, at);
    expect(finished.finishedAt).toBe(at);
    // A retry without a time keeps the original finish time.
    expect((await finishSession(db, input.id)).finishedAt).toBe(at);

    const reopened = await reopenSession(db, input.id);
    expect(reopened.finishedAt).toBeNull();
    expect((await reopenSession(db, input.id)).finishedAt).toBeNull();
    expect((await finishSession(db, input.id)).finishedAt).not.toBeNull();

    // Edits stay possible after reopening.
    const rowId = input.exercises[0].id;
    await upsertSet(db, input.id, rowId, set(5, 60, 8));
    await expect(finishSession(db, randomUUID())).rejects.toMatchObject({
      status: 404,
    });
  });
});

describe("loadCatalog (preview data)", () => {
  it("starts the rotation at the first day, then advances past done sessions", async () => {
    let catalog = await loadCatalog(db);
    expect(catalog.nextDayByProgram[ids.program]).toBe(ids.push);
    expect(catalog.locations.map((l) => l.name).sort()).toEqual([
      "Elm Street Gym",
      "Home",
    ]);
    expect(catalog.settings).toMatchObject({
      activeProgramId: ids.program,
      lastLocationId: ids.home,
    });
    expect(catalog.programs[0].days.map((d) => d.name)).toEqual([
      "Push",
      "Pull",
      "Legs",
    ]);

    // A Push session with no done sets does not count.
    const empty = startInput({
      exercises: [],
    });
    await createSession(db, empty.input);
    catalog = await loadCatalog(db);
    expect(catalog.nextDayByProgram[ids.program]).toBe(ids.push);

    // One with a done set does.
    await createSession(db, startInput().input);
    catalog = await loadCatalog(db);
    expect(catalog.nextDayByProgram[ids.program]).toBe(ids.pull);
  });

  it("ignores freestyle sessions for rotation", async () => {
    await createSession(
      db,
      startInput({ programId: null, programDayId: null }).input,
    );
    const catalog = await loadCatalog(db);
    expect(catalog.nextDayByProgram[ids.program]).toBe(ids.push);
  });

  it("reports usage per location and last done sets", async () => {
    const dumbbell = ids.exercise["Incline dumbbell press"];
    const home = startInput({ locationId: ids.home });
    await createSession(db, home.input);
    const catalog = await loadCatalog(db);

    expect(catalog.lastUsedAnywhere[dumbbell]).toBeDefined();
    expect(catalog.lastUsedByLocation[ids.home][dumbbell]).toBeDefined();
    expect(catalog.lastUsedByLocation[ids.gym]?.[dumbbell]).toBeUndefined();
    // Only the done set is reported.
    expect(catalog.lastSets[dumbbell]).toEqual([
      { position: 0, weight: 50, reps: 10 },
    ]);
    // Unused exercises have no history.
    expect(catalog.lastSets[ids.exercise["Dips"]]).toBeUndefined();
  });

  it("uses only the most recent session for last sets and can exclude one", async () => {
    const dumbbell = ids.exercise["Incline dumbbell press"];
    const older = startInput({
      startedAt: "2026-10-01T10:00:00.000Z",
      date: "2026-10-01",
    });
    older.input.exercises[0].sets = [set(0, 40, 12), set(1, 40, 12)];
    await createSession(db, older.input);
    const newer = startInput({
      startedAt: "2026-10-20T10:00:00.000Z",
      date: "2026-10-20",
    });
    newer.input.exercises[0].sets = [set(0, 50, 10)];
    await createSession(db, newer.input);

    let catalog = await loadCatalog(db);
    expect(catalog.lastSets[dumbbell]).toEqual([
      { position: 0, weight: 50, reps: 10 },
    ]);
    catalog = await loadCatalog(db, { excludeSessionId: newer.input.id });
    expect(catalog.lastSets[dumbbell]).toHaveLength(2);
    expect(catalog.lastSets[dumbbell][0].weight).toBe(40);
  });

  it("omits archived locations and exercises", async () => {
    await db
      .update(s.exercises)
      .set({ archivedAt: new Date() })
      .where(eq(s.exercises.id, ids.exercise["Dips"]));
    await db
      .update(s.locations)
      .set({ archivedAt: new Date() })
      .where(eq(s.locations.id, ids.gym));
    const catalog = await loadCatalog(db);
    expect(catalog.exercises.some((e) => e.name === "Dips")).toBe(false);
    expect(catalog.locations.map((l) => l.id)).toEqual([ids.home]);
  });
});
