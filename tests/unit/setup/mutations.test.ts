// @vitest-environment node
import { beforeAll, describe, expect, it } from "vitest";
import { createTestDb, type Database } from "@/db/client";
import {
  getExercise,
  getLocation,
  getSettings,
  getSetupCounts,
  listEquipment,
  listExercises,
  listMovements,
} from "@/db/queries/setup";
import * as s from "@/db/schema";
import {
  createEquipment,
  createExercise,
  createLocation,
  createMovement,
  deleteEquipment,
  deleteExercise,
  deleteLocation,
  deleteMovement,
  normalizeWeights,
  setExerciseArchived,
  setLocationArchived,
  updateEquipment,
  updateExercise,
  updateLocation,
  updateSettings,
  type Result,
} from "@/features/setup/mutations";
import { groupByMovement } from "@/features/setup/group-exercises";
import { exerciseInputSchema } from "@/lib/validation/setup";

let db: Database;

beforeAll(async () => {
  db = await createTestDb();
}, 60_000);

function value<T>(result: Result<T>): T {
  if (!result.ok) throw new Error(result.error);
  return result.value;
}

describe("equipment and movements", () => {
  it("creates, renames, rejects duplicates case-insensitively", async () => {
    const bench = value(
      await createEquipment(db, { name: "Flat bench", hasWeights: false }),
    );
    expect(bench.usage).toBeNull();
    const dup = await createEquipment(db, {
      name: "flat BENCH",
      hasWeights: false,
    });
    expect(dup).toMatchObject({ ok: false, status: 409 });

    const renamed = value(
      await updateEquipment(db, bench.id, { name: "Bench", hasWeights: true }),
    );
    expect(renamed).toMatchObject({ name: "Bench", hasWeights: true });
    expect(
      await updateEquipment(db, crypto.randomUUID(), {
        name: "X",
        hasWeights: false,
      }),
    ).toMatchObject({ ok: false, status: 404 });
  });

  it("deletes unused equipment but blocks when in use", async () => {
    const used = value(
      await createEquipment(db, { name: "Used rack", hasWeights: false }),
    );
    const spare = value(
      await createEquipment(db, { name: "Spare rack", hasWeights: false }),
    );
    value(
      await createExercise(db, {
        name: "Rack pull",
        movementId: null,
        loadType: "total",
        baseWeight: 0,
        weightEquipmentId: null,
        increment: 5,
        equipmentIds: [used.id],
      }),
    );

    const blocked = await deleteEquipment(db, used.id);
    expect(blocked).toMatchObject({ ok: false, status: 409 });
    expect(blocked.ok ? "" : blocked.error).toContain("1 exercise");

    expect(await deleteEquipment(db, spare.id)).toMatchObject({ ok: true });
    const names = (await listEquipment(db)).map((e) => e.name);
    expect(names).not.toContain("Spare rack");
  });

  it("deletes movements only when no exercise uses them", async () => {
    const hinge = value(await createMovement(db, { name: "Hinge" }));
    const squat = value(await createMovement(db, { name: "Squat" }));
    value(
      await createExercise(db, {
        name: "Romanian deadlift",
        movementId: hinge.id,
        loadType: "per_side",
        baseWeight: 45,
        weightEquipmentId: null,
        increment: 5,
        equipmentIds: [],
      }),
    );
    expect(await deleteMovement(db, hinge.id)).toMatchObject({
      ok: false,
      status: 409,
    });
    expect(await deleteMovement(db, squat.id)).toMatchObject({ ok: true });
    const movements = await listMovements(db);
    expect(movements.find((m) => m.id === hinge.id)?.usage).toBe("1 exercise");
  });
});

describe("locations", () => {
  it("persists weights ascending and de-duplicated, null for non-weighted", async () => {
    const dumbbells = value(
      await createEquipment(db, { name: "Dumbbells", hasWeights: true }),
    );
    const incline = value(
      await createEquipment(db, { name: "Incline bench", hasWeights: false }),
    );
    const home = value(
      await createLocation(db, {
        name: "Home",
        equipment: [
          { equipmentId: dumbbells.id, weights: [20, 5, 10, 10, 15] },
          { equipmentId: incline.id, weights: [1, 2] },
        ],
      }),
    );
    expect(home.archived).toBe(false);
    const byId = Object.fromEntries(
      home.equipment.map((e) => [e.equipmentId, e.weights]),
    );
    expect(byId[dumbbells.id]).toEqual([5, 10, 15, 20]);
    expect(byId[incline.id]).toBeNull();

    // Toggling a weight off and saving replaces the list.
    const updated = value(
      await updateLocation(db, home.id, {
        name: "Home gym",
        equipment: [{ equipmentId: dumbbells.id, weights: [5, 10, 20] }],
      }),
    );
    expect(updated.name).toBe("Home gym");
    expect(updated.equipment).toEqual([
      { equipmentId: dumbbells.id, weights: [5, 10, 20] },
    ]);
    expect((await getLocation(db, home.id))?.equipment).toHaveLength(1);
  });

  it("rejects unknown equipment and duplicate names", async () => {
    expect(
      await createLocation(db, {
        name: "Ghost",
        equipment: [{ equipmentId: crypto.randomUUID(), weights: null }],
      }),
    ).toMatchObject({ ok: false, status: 400 });
    expect(
      await getLocation(db, "00000000-0000-4000-8000-000000000000"),
    ).toBeNull();
    expect(
      await createLocation(db, { name: "home gym", equipment: [] }),
    ).toMatchObject({ ok: false, status: 409 });
  });

  it("deletes unused locations and requires archiving when sessions reference them", async () => {
    const gym = value(
      await createLocation(db, { name: "Elm St", equipment: [] }),
    );
    const temp = value(
      await createLocation(db, { name: "Temp", equipment: [] }),
    );
    await db.insert(s.sessions).values({
      id: crypto.randomUUID(),
      date: "2026-10-01",
      kind: "strength",
      locationId: gym.id,
    });

    const blocked = await deleteLocation(db, gym.id);
    expect(blocked).toMatchObject({ ok: false, status: 409 });
    expect(await deleteLocation(db, temp.id)).toMatchObject({ ok: true });

    const archived = value(await setLocationArchived(db, gym.id, true));
    expect(archived.archived).toBe(true);
    expect(archived.sessionCount).toBe(1);
    expect(value(await setLocationArchived(db, gym.id, false)).archived).toBe(
      false,
    );
    expect((await getSetupCounts(db)).locations).toBeGreaterThanOrEqual(1);
  });
});

describe("exercises", () => {
  it("creates with equipment and weight equipment, then updates", async () => {
    const stack = value(
      await createEquipment(db, { name: "Cable stack", hasWeights: true }),
    );
    const pulley = value(
      await createEquipment(db, { name: "Pulley", hasWeights: false }),
    );
    const movement = value(await createMovement(db, { name: "Vertical pull" }));
    const created = value(
      await createExercise(db, {
        name: "Lat pulldown",
        movementId: movement.id,
        loadType: "total",
        baseWeight: 0,
        weightEquipmentId: stack.id,
        increment: 10,
        equipmentIds: [stack.id, pulley.id],
      }),
    );
    expect(created).toMatchObject({
      loadType: "total",
      weightEquipmentId: stack.id,
      increment: 10,
      archived: false,
    });
    expect([...created.equipmentIds].sort()).toEqual(
      [stack.id, pulley.id].sort(),
    );

    const updated = value(
      await updateExercise(db, created.id, {
        name: "Wide lat pulldown",
        movementId: null,
        loadType: "total",
        baseWeight: 0,
        weightEquipmentId: null,
        increment: 5,
        equipmentIds: [pulley.id],
      }),
    );
    expect(updated.equipmentIds).toEqual([pulley.id]);
    expect(updated.movementId).toBeNull();
    expect(
      await createExercise(db, {
        name: "wide lat pulldown",
        movementId: null,
        loadType: "total",
        baseWeight: 0,
        weightEquipmentId: null,
        increment: 5,
        equipmentIds: [],
      }),
    ).toMatchObject({ ok: false, status: 409 });
  });

  it("archives instead of deleting when history references it", async () => {
    const lift = value(
      await createExercise(db, {
        name: "Dip",
        movementId: null,
        loadType: "bodyweight",
        baseWeight: 0,
        weightEquipmentId: null,
        increment: 5,
        equipmentIds: [],
      }),
    );
    const sessionId = crypto.randomUUID();
    await db
      .insert(s.sessions)
      .values({ id: sessionId, date: "2026-10-02", kind: "strength" });
    await db.insert(s.sessionExercises).values({
      id: crypto.randomUUID(),
      sessionId,
      exerciseId: lift.id,
      position: 0,
      name: "Dip",
      loadType: "bodyweight",
    });

    const blocked = await deleteExercise(db, lift.id);
    expect(blocked).toMatchObject({ ok: false, status: 409 });
    expect((await getExercise(db, lift.id))?.usage).toBe("1 logged workout");

    expect(value(await setExerciseArchived(db, lift.id, true)).archived).toBe(
      true,
    );

    const spare = value(
      await createExercise(db, {
        name: "Spare lift",
        movementId: null,
        loadType: "total",
        baseWeight: 0,
        weightEquipmentId: null,
        increment: 5,
        equipmentIds: [],
      }),
    );
    expect(await deleteExercise(db, spare.id)).toMatchObject({ ok: true });
    expect((await listExercises(db)).some((e) => e.id === spare.id)).toBe(
      false,
    );
  });

  it("groups by movement with unassigned last", async () => {
    const movements = await listMovements(db);
    const exercises = await listExercises(db);
    const groups = groupByMovement(
      exercises.filter((e) => !e.archived),
      movements,
    );
    expect(groups.at(-1)?.title).toBe("No movement");
    expect(groups.map((g) => g.title)).toContain("Hinge");
  });

  it("schema requires weight equipment among the required equipment", () => {
    const id = crypto.randomUUID();
    const bad = exerciseInputSchema.safeParse({
      name: "X",
      loadType: "total",
      weightEquipmentId: id,
      equipmentIds: [],
    });
    expect(bad.success).toBe(false);
  });
});

describe("settings and helpers", () => {
  it("reads defaults and updates bodyweight", async () => {
    expect((await getSettings(db)).bodyweightLb).toBe(0);
    const next = value(await updateSettings(db, { bodyweightLb: 185 }));
    expect(next.bodyweightLb).toBe(185);
    expect((await getSettings(db)).bodyweightLb).toBe(185);
  });

  it("normalizes weight lists", () => {
    expect(normalizeWeights([10, 5, 10])).toEqual([5, 10]);
    expect(normalizeWeights([])).toBeNull();
    expect(normalizeWeights(null)).toBeNull();
  });
});
