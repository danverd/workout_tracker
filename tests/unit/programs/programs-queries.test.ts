// @vitest-environment node
import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import { beforeAll, describe, expect, it } from "vitest";
import { createTestDb, type Database } from "@/db/client";
import * as s from "@/db/schema";
import {
  createProgram,
  getActiveProgramId,
  getProgram,
  listPrograms,
  ProgramError,
  saveProgram,
  setActiveProgram,
  setProgramArchived,
} from "@/db/queries/programs";
import {
  programSaveSchema,
  programSlotInputSchema,
  type ProgramSaveInput,
} from "@/lib/validation/programs";

let db: Database;
let pressId: string;
let rowId: string;
let benchId: string;

beforeAll(async () => {
  db = await createTestDb();
  [{ id: pressId }] = await db
    .insert(s.movements)
    .values({ name: "Horizontal press" })
    .returning({ id: s.movements.id });
  [{ id: rowId }] = await db
    .insert(s.movements)
    .values({ name: "Row" })
    .returning({ id: s.movements.id });
  [{ id: benchId }] = await db
    .insert(s.exercises)
    .values({ name: "Bench press", movementId: pressId, loadType: "per_side" })
    .returning({ id: s.exercises.id });
}, 60_000);

const parse = (input: unknown): ProgramSaveInput =>
  programSaveSchema.parse(input);

const slot = (extra: Record<string, unknown> = {}) => ({
  movementId: pressId,
  targetSets: 3,
  repMin: 8,
  repMax: 12,
  ...extra,
});

describe("saveProgram", () => {
  it("creates a program with ordered days and slots", async () => {
    const program = await createProgram(
      db,
      parse({
        name: "PPL",
        days: [
          { name: "Push", slots: [slot(), slot({ movementId: rowId })] },
          { name: "Pull", slots: [] },
        ],
      }),
    );
    expect(program.days.map((d) => d.name)).toEqual(["Push", "Pull"]);
    expect(program.days[0].slots.map((x) => x.movementId)).toEqual([
      pressId,
      rowId,
    ]);
    expect(program.days[0].slots[0]).toMatchObject({
      sets: 3,
      repMin: 8,
      repMax: 12,
      amrap: false,
    });
  });

  it("preserves existing day and slot ids and applies reorder", async () => {
    const created = await createProgram(
      db,
      parse({
        name: "Keep ids",
        days: [
          { name: "A", slots: [slot(), slot({ movementId: rowId })] },
          { name: "B", slots: [] },
        ],
      }),
    );
    const [a, b] = created.days;
    const [s1, s2] = a.slots;

    const saved = (await saveProgram(
      db,
      created.id,
      parse({
        name: "Keep ids renamed",
        days: [
          { id: b.id, name: "B first", slots: [] },
          {
            id: a.id,
            name: "A second",
            slots: [
              { ...slot({ movementId: rowId }), id: s2.id, targetSets: 5 },
              { ...slot(), id: s1.id },
              slot({ exerciseId: benchId, movementId: null }),
            ],
          },
        ],
      }),
    ))!;

    expect(saved.name).toBe("Keep ids renamed");
    expect(saved.days.map((d) => d.id)).toEqual([b.id, a.id]);
    expect(saved.days.map((d) => d.position)).toEqual([0, 1]);
    expect(saved.days[1].slots.map((x) => x.id).slice(0, 2)).toEqual([
      s2.id,
      s1.id,
    ]);
    expect(saved.days[1].slots[0].sets).toBe(5);
    expect(saved.days[1].slots[2].exerciseId).toBe(benchId);
  });

  it("accepts client-generated ids for new rows", async () => {
    const dayId = randomUUID();
    const slotId = randomUUID();
    const created = await createProgram(db, parse({ name: "Client ids" }));
    const saved = (await saveProgram(
      db,
      created.id,
      parse({
        name: "Client ids",
        days: [{ id: dayId, name: "D", slots: [{ ...slot(), id: slotId }] }],
      }),
    ))!;
    expect(saved.days[0].id).toBe(dayId);
    expect(saved.days[0].slots[0].id).toBe(slotId);
  });

  it("deletes removed slots and days and nulls session links", async () => {
    const created = await createProgram(
      db,
      parse({
        name: "Delete",
        days: [
          { name: "Keep", slots: [slot(), slot({ movementId: rowId })] },
          { name: "Drop", slots: [slot()] },
        ],
      }),
    );
    const [keep, drop] = created.days;
    const sessionId = randomUUID();
    const sessionExerciseId = randomUUID();
    await db.insert(s.sessions).values({
      id: sessionId,
      date: "2026-10-30",
      kind: "strength",
      programId: created.id,
      programDayId: drop.id,
    });
    await db.insert(s.sessionExercises).values({
      id: sessionExerciseId,
      sessionId,
      slotId: keep.slots[1].id,
      position: 0,
      name: "Row",
      loadType: "total",
    });

    const saved = (await saveProgram(
      db,
      created.id,
      parse({
        name: "Delete",
        days: [
          {
            id: keep.id,
            name: "Keep",
            slots: [{ ...slot(), id: keep.slots[0].id }],
          },
        ],
      }),
    ))!;
    expect(saved.days).toHaveLength(1);
    expect(saved.days[0].slots.map((x) => x.id)).toEqual([keep.slots[0].id]);

    const [session] = await db
      .select()
      .from(s.sessions)
      .where(eq(s.sessions.id, sessionId));
    expect(session.programDayId).toBeNull();
    const [exercise] = await db
      .select()
      .from(s.sessionExercises)
      .where(eq(s.sessionExercises.id, sessionExerciseId));
    expect(exercise.slotId).toBeNull();
  });

  it("keeps a slot that moves to another day", async () => {
    const created = await createProgram(
      db,
      parse({
        name: "Move",
        days: [
          { name: "One", slots: [slot()] },
          { name: "Two", slots: [] },
        ],
      }),
    );
    const [one, two] = created.days;
    const moving = one.slots[0];
    const saved = (await saveProgram(
      db,
      created.id,
      parse({
        name: "Move",
        days: [
          { id: two.id, name: "Two", slots: [{ ...slot(), id: moving.id }] },
        ],
      }),
    ))!;
    expect(saved.days[0].slots[0].id).toBe(moving.id);
  });

  it("rolls back the whole save when a reference is missing", async () => {
    const created = await createProgram(
      db,
      parse({ name: "Atomic", days: [{ name: "Day", slots: [slot()] }] }),
    );
    await expect(
      saveProgram(
        db,
        created.id,
        parse({
          name: "Changed",
          days: [{ name: "X", slots: [slot({ movementId: randomUUID() })] }],
        }),
      ),
    ).rejects.toBeInstanceOf(ProgramError);
    const after = (await getProgram(db, created.id))!;
    expect(after.name).toBe("Atomic");
    expect(after.days[0].name).toBe("Day");
  });

  it("returns null for an unknown program", async () => {
    expect(
      await saveProgram(db, randomUUID(), parse({ name: "x" })),
    ).toBeNull();
  });

  it("stores AMRAP without rep bounds", async () => {
    const program = await createProgram(
      db,
      parse({
        name: "Amrap",
        days: [{ name: "D", slots: [slot({ amrap: true })] }],
      }),
    );
    expect(program.days[0].slots[0]).toMatchObject({
      amrap: true,
      repMin: null,
      repMax: null,
    });
  });
});

describe("slot validation", () => {
  it("requires exactly one of movement or exercise", () => {
    expect(
      programSlotInputSchema.safeParse({ movementId: null, exerciseId: null })
        .success,
    ).toBe(false);
    expect(
      programSlotInputSchema.safeParse({
        movementId: pressId,
        exerciseId: benchId,
      }).success,
    ).toBe(false);
    expect(
      programSlotInputSchema.safeParse({ exerciseId: benchId }).success,
    ).toBe(true);
  });

  it("rejects an inverted rep range", () => {
    expect(
      programSlotInputSchema.safeParse({
        movementId: pressId,
        repMin: 12,
        repMax: 8,
      }).success,
    ).toBe(false);
  });

  it("is enforced by the database too", async () => {
    const created = await createProgram(
      db,
      parse({ name: "Check", days: [{ name: "D" }] }),
    );
    await expect(
      db.insert(s.programSlots).values({
        dayId: created.days[0].id,
        position: 0,
        movementId: null,
        exerciseId: null,
      }),
    ).rejects.toThrow();
  });
});

describe("active and archive", () => {
  it("sets the active program, creating the settings row", async () => {
    const a = await createProgram(db, parse({ name: "Active A" }));
    const b = await createProgram(db, parse({ name: "Active B" }));
    await setActiveProgram(db, a.id);
    expect(await getActiveProgramId(db)).toBe(a.id);
    await setActiveProgram(db, b.id);
    expect(await getActiveProgramId(db)).toBe(b.id);
    const list = await listPrograms(db);
    expect(list[0]).toMatchObject({ id: b.id, active: true });
    expect(list.filter((p) => p.active)).toHaveLength(1);
  });

  it("rejects missing and archived programs", async () => {
    await expect(setActiveProgram(db, randomUUID())).rejects.toMatchObject({
      status: 404,
    });
    const c = await createProgram(db, parse({ name: "Archived C" }));
    await setProgramArchived(db, c.id, true);
    await expect(setActiveProgram(db, c.id)).rejects.toMatchObject({
      status: 409,
    });
  });

  it("archives, hides, restores, and clears active when archiving it", async () => {
    const d = await createProgram(db, parse({ name: "Archive D" }));
    await setActiveProgram(db, d.id);
    const archived = (await setProgramArchived(db, d.id, true))!;
    expect(archived.archived).toBe(true);
    expect(await getActiveProgramId(db)).toBeNull();
    expect((await listPrograms(db)).some((p) => p.id === d.id)).toBe(false);
    expect(
      (await listPrograms(db, { includeArchived: true })).some(
        (p) => p.id === d.id,
      ),
    ).toBe(true);
    const restored = (await setProgramArchived(db, d.id, false))!;
    expect(restored.archived).toBe(false);
    expect(await setProgramArchived(db, randomUUID(), true)).toBeNull();
  });
});
