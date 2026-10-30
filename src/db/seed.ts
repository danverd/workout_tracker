import { expandRange } from "../lib/domain/weights";
import type { LoadType } from "../types/domain";
import type { Database } from "./client";
import * as s from "./schema";

/**
 * Dev-only sample data. Skips (returns false) when the database already has
 * locations so it never doubles up. Exported so tests can target any db.
 */
export async function seedDatabase(db: Database): Promise<boolean> {
  const existing = await db.select({ id: s.locations.id }).from(s.locations);
  if (existing.length > 0) return false;

  await db.transaction(async (tx) => {
    const equipmentRows = await tx
      .insert(s.equipment)
      .values(
        [
          ["Dumbbells", true],
          ["Incline bench", false],
          ["Flat bench", false],
          ["Barbell", true],
          ["Squat rack", false],
          ["Cable stack", true],
          ["Leg press", true],
          ["Lat pulldown machine", true],
          ["Assisted pull-up machine", true],
          ["Pull-up bar", false],
          ["Dip station", false],
        ].map(([name, hasWeights]) => ({
          name: name as string,
          hasWeights: hasWeights as boolean,
        })),
      )
      .returning();
    const eq = Object.fromEntries(equipmentRows.map((e) => [e.name, e.id]));

    const [home, gym] = await tx
      .insert(s.locations)
      .values([{ name: "Home" }, { name: "Elm Street Gym" }])
      .returning();

    const stack = expandRange({ min: 10, max: 200, step: 10 });
    await tx.insert(s.locationEquipment).values([
      {
        locationId: home.id,
        equipmentId: eq["Dumbbells"],
        weights: expandRange({ min: 5, max: 80, step: 5 }),
      },
      { locationId: home.id, equipmentId: eq["Incline bench"], weights: null },
      ...(
        [
          "Flat bench",
          "Incline bench",
          "Barbell",
          "Squat rack",
          "Leg press",
          "Pull-up bar",
          "Dip station",
        ] as const
      ).map((name) => ({
        locationId: gym.id,
        equipmentId: eq[name],
        weights: null,
      })),
      {
        locationId: gym.id,
        equipmentId: eq["Dumbbells"],
        weights: expandRange({ min: 5, max: 100, step: 5 }),
      },
      ...(
        [
          "Cable stack",
          "Lat pulldown machine",
          "Assisted pull-up machine",
        ] as const
      ).map((name) => ({
        locationId: gym.id,
        equipmentId: eq[name],
        weights: stack,
      })),
    ]);

    const movementRows = await tx
      .insert(s.movements)
      .values(
        [
          "Horizontal press",
          "Vertical press",
          "Vertical pull",
          "Horizontal pull",
          "Squat",
          "Hinge",
          "Biceps",
          "Triceps",
        ].map((name) => ({ name })),
      )
      .returning();
    const mv = Object.fromEntries(movementRows.map((m) => [m.name, m.id]));

    type Seed = [
      name: string,
      movement: string,
      loadType: LoadType,
      equipment: string[],
      weightEquipment: string | null,
      baseWeight: number,
      increment: number,
    ];
    const exerciseSeeds: Seed[] = [
      [
        "Incline dumbbell press",
        "Horizontal press",
        "per_hand",
        ["Dumbbells", "Incline bench"],
        "Dumbbells",
        0,
        5,
      ],
      [
        "Barbell bench press",
        "Horizontal press",
        "per_side",
        ["Barbell", "Flat bench"],
        null,
        45,
        5,
      ],
      [
        "Cable chest press",
        "Horizontal press",
        "total",
        ["Cable stack"],
        "Cable stack",
        0,
        10,
      ],
      [
        "Seated dumbbell shoulder press",
        "Vertical press",
        "per_hand",
        ["Dumbbells", "Incline bench"],
        "Dumbbells",
        0,
        5,
      ],
      [
        "Barbell overhead press",
        "Vertical press",
        "per_side",
        ["Barbell"],
        null,
        45,
        5,
      ],
      [
        "Lat pulldown",
        "Vertical pull",
        "total",
        ["Lat pulldown machine"],
        "Lat pulldown machine",
        0,
        10,
      ],
      [
        "Assisted pull-up",
        "Vertical pull",
        "assisted",
        ["Assisted pull-up machine"],
        "Assisted pull-up machine",
        0,
        10,
      ],
      ["Pull-up", "Vertical pull", "bodyweight", ["Pull-up bar"], null, 0, 5],
      [
        "One-arm dumbbell row",
        "Horizontal pull",
        "per_hand",
        ["Dumbbells"],
        "Dumbbells",
        0,
        5,
      ],
      [
        "Seated cable row",
        "Horizontal pull",
        "total",
        ["Cable stack"],
        "Cable stack",
        0,
        10,
      ],
      [
        "Barbell back squat",
        "Squat",
        "per_side",
        ["Barbell", "Squat rack"],
        null,
        45,
        5,
      ],
      ["Leg press", "Squat", "per_side", ["Leg press"], null, 100, 10],
      [
        "Dumbbell Romanian deadlift",
        "Hinge",
        "per_hand",
        ["Dumbbells"],
        "Dumbbells",
        0,
        5,
      ],
      ["Dumbbell curl", "Biceps", "per_hand", ["Dumbbells"], "Dumbbells", 0, 5],
      [
        "Cable triceps pushdown",
        "Triceps",
        "total",
        ["Cable stack"],
        "Cable stack",
        0,
        10,
      ],
      ["Dips", "Triceps", "bodyweight", ["Dip station"], null, 0, 5],
    ];
    const exerciseRows = await tx
      .insert(s.exercises)
      .values(
        exerciseSeeds.map(
          ([name, movement, loadType, , weightEq, baseWeight, increment]) => ({
            name,
            movementId: mv[movement],
            loadType,
            baseWeight,
            weightEquipmentId: weightEq ? eq[weightEq] : null,
            increment,
          }),
        ),
      )
      .returning();
    const ex = Object.fromEntries(exerciseRows.map((e) => [e.name, e.id]));
    await tx
      .insert(s.exerciseEquipment)
      .values(
        exerciseSeeds.flatMap(([name, , , equipment]) =>
          equipment.map((e) => ({ exerciseId: ex[name], equipmentId: eq[e] })),
        ),
      );

    const [program] = await tx
      .insert(s.programs)
      .values({ name: "Push / Pull / Legs" })
      .returning();
    const days = await tx
      .insert(s.programDays)
      .values(
        ["Push", "Pull", "Legs"].map((name, position) => ({
          programId: program.id,
          name,
          position,
        })),
      )
      .returning();
    const day = Object.fromEntries(days.map((d) => [d.name, d.id]));

    type Slot = [
      movement: string | null,
      exercise: string | null,
      sets: number,
      repMin: number,
      repMax: number,
    ];
    const plan: Record<string, Slot[]> = {
      Push: [
        ["Horizontal press", null, 4, 6, 10],
        ["Vertical press", null, 3, 8, 12],
        [null, "Dips", 3, 8, 12],
        ["Triceps", null, 3, 10, 15],
      ],
      Pull: [
        ["Vertical pull", null, 4, 6, 10],
        ["Horizontal pull", null, 3, 8, 12],
        [null, "Pull-up", 3, 5, 8],
        ["Biceps", null, 3, 10, 15],
      ],
      Legs: [
        ["Squat", null, 4, 6, 10],
        ["Hinge", null, 3, 8, 12],
        [null, "Leg press", 3, 10, 15],
      ],
    };
    await tx.insert(s.programSlots).values(
      Object.entries(plan).flatMap(([dayName, slots]) =>
        slots.map(
          ([movement, exercise, targetSets, repMin, repMax], position) => ({
            dayId: day[dayName],
            position,
            movementId: movement ? mv[movement] : null,
            exerciseId: exercise ? ex[exercise] : null,
            targetSets,
            repMin,
            repMax,
          }),
        ),
      ),
    );

    await tx
      .insert(s.settings)
      .values({
        id: 1,
        bodyweightLb: 180,
        activeProgramId: program.id,
        lastLocationId: home.id,
      })
      .onConflictDoUpdate({
        target: s.settings.id,
        set: {
          bodyweightLb: 180,
          activeProgramId: program.id,
          lastLocationId: home.id,
        },
      });
  });
  return true;
}
