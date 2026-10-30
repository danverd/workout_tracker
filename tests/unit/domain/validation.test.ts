import { randomUUID } from "node:crypto";
import { describe, expect, it } from "vitest";
import { programSaveSchema } from "@/lib/validation/programs";
import {
  sessionCreateSchema,
  cardioInputSchema,
} from "@/lib/validation/sessions";
import { exerciseInputSchema } from "@/lib/validation/setup";

describe("validation schemas", () => {
  it("requires exactly one of movement or exercise per slot", () => {
    const slot = { targetSets: 3 };
    expect(
      programSaveSchema.safeParse({
        name: "PPL",
        days: [{ name: "Push", slots: [slot] }],
      }).success,
    ).toBe(false);
    expect(
      programSaveSchema.safeParse({
        name: "PPL",
        days: [
          {
            name: "Push",
            slots: [
              { ...slot, movementId: randomUUID(), repMin: 8, repMax: 12 },
            ],
          },
        ],
      }).success,
    ).toBe(true);
  });
  it("rejects inverted rep ranges", () => {
    const result = programSaveSchema.safeParse({
      name: "PPL",
      days: [
        {
          name: "Push",
          slots: [{ movementId: randomUUID(), repMin: 12, repMax: 8 }],
        },
      ],
    });
    expect(result.success).toBe(false);
  });
  it("requires weight equipment to be a required equipment", () => {
    const equipmentId = randomUUID();
    const base = { name: "Press", loadType: "per_hand" as const };
    expect(
      exerciseInputSchema.safeParse({
        ...base,
        equipmentIds: [equipmentId],
        weightEquipmentId: randomUUID(),
      }).success,
    ).toBe(false);
    expect(
      exerciseInputSchema.safeParse({
        ...base,
        equipmentIds: [equipmentId],
        weightEquipmentId: equipmentId,
      }).success,
    ).toBe(true);
  });
  it("applies defaults for session creation and rejects volume-free junk", () => {
    const parsed = sessionCreateSchema.parse({
      id: randomUUID(),
      exercises: [
        {
          id: randomUUID(),
          exerciseId: randomUUID(),
          position: 0,
          sets: [{ id: randomUUID(), position: 0, weight: 50 }],
        },
      ],
    });
    expect(parsed.exercises[0].sets[0]).toMatchObject({
      reps: null,
      done: false,
      weight: 50,
    });
    expect(sessionCreateSchema.safeParse({ id: "not-a-uuid" }).success).toBe(
      false,
    );
    expect(
      sessionCreateSchema.safeParse({ id: randomUUID(), date: "2026-13-40" })
        .success,
    ).toBe(false);
  });
  it("validates cardio entries", () => {
    expect(
      cardioInputSchema.safeParse({
        id: randomUUID(),
        activity: "Walk",
        durationSec: 1800,
        distance: 2,
        distanceUnit: "mi",
      }).success,
    ).toBe(true);
    expect(
      cardioInputSchema.safeParse({ id: randomUUID(), activity: " " }).success,
    ).toBe(false);
  });
});
