import { describe, expect, it } from "vitest";
import {
  rankCandidates,
  resolveSlots,
  type ResolvableExercise,
  type SlotInput,
} from "@/lib/domain/resolve-slots";
import type { UsageHistory } from "@/types/domain";

const exercise = (
  id: string,
  movementId: string | null,
  equipmentIds: string[],
  extra: Partial<ResolvableExercise> = {},
): ResolvableExercise => ({
  id,
  name: id,
  movementId,
  equipmentIds,
  archived: false,
  ...extra,
});
const movementSlot = (id: string, movementId: string): SlotInput => ({
  id,
  movementId,
  exerciseId: null,
  sets: 3,
  repMin: 8,
  repMax: 12,
  amrap: false,
});
const exerciseSlot = (id: string, exerciseId: string): SlotInput => ({
  id,
  movementId: null,
  exerciseId,
  sets: 3,
  repMin: 8,
  repMax: 12,
  amrap: false,
});
const noUsage: UsageHistory = { lastUsedAtLocation: {}, lastUsedAnywhere: {} };

const exercises = [
  exercise("bb-bench", "press", ["barbell", "bench"]),
  exercise("db-press", "press", ["dumbbells", "bench"]),
  exercise("cable-press", "press", ["cable"]),
  exercise("pushup", "press", []),
  exercise("curl", "biceps", ["dumbbells"]),
];

describe("rankCandidates", () => {
  it("orders by recency here, then recency anywhere, then alphabetical", () => {
    const usage: UsageHistory = {
      lastUsedAtLocation: { c: "2026-10-01", d: "2026-10-05" },
      lastUsedAnywhere: {
        c: "2026-10-01",
        d: "2026-10-05",
        b: "2026-10-20",
        a: "2026-10-10",
      },
    };
    const ids = ["e", "c", "b", "a", "d"].map((id) => exercise(id, null, []));
    expect(rankCandidates(ids, usage).map((e) => e.id)).toEqual([
      "d",
      "c",
      "b",
      "a",
      "e",
    ]);
  });
});

describe("resolveSlots", () => {
  it("picks the exercise last used at this location for a movement slot", () => {
    const [resolved] = resolveSlots({
      slots: [movementSlot("s1", "press")],
      exercises,
      locationEquipmentIds: ["dumbbells", "bench", "barbell"],
      usage: {
        lastUsedAtLocation: { "bb-bench": "2026-10-01" },
        lastUsedAnywhere: {
          "bb-bench": "2026-10-01",
          "db-press": "2026-10-20",
        },
      },
    });
    expect(resolved.status).toBe("resolved");
    expect(resolved.exerciseId).toBe("bb-bench");
    expect(resolved.candidateIds).toEqual(["bb-bench", "db-press", "pushup"]);
  });
  it("falls back to last used anywhere, then alphabetical", () => {
    const here = ["dumbbells", "bench", "barbell"];
    const [byAnywhere] = resolveSlots({
      slots: [movementSlot("s1", "press")],
      exercises,
      locationEquipmentIds: here,
      usage: {
        lastUsedAtLocation: {},
        lastUsedAnywhere: { "db-press": "2026-10-20" },
      },
    });
    expect(byAnywhere.exerciseId).toBe("db-press");
    const [alphabetical] = resolveSlots({
      slots: [movementSlot("s1", "press")],
      exercises,
      locationEquipmentIds: here,
      usage: noUsage,
    });
    expect(alphabetical.exerciseId).toBe("bb-bench");
  });
  it("excludes exercises whose equipment is missing, and archived ones", () => {
    const [resolved] = resolveSlots({
      slots: [movementSlot("s1", "press")],
      exercises: [
        ...exercises,
        exercise("old", "press", [], { archived: true }),
      ],
      locationEquipmentIds: ["cable"],
      usage: noUsage,
    });
    expect(resolved.candidateIds).toEqual(["cable-press", "pushup"]);
    expect(resolved.availableIds).toEqual(["cable-press", "pushup"]);
  });
  it("asks the owner to choose when a movement has no candidates", () => {
    const [resolved] = resolveSlots({
      slots: [movementSlot("s1", "biceps")],
      exercises,
      locationEquipmentIds: ["cable"],
      usage: noUsage,
    });
    expect(resolved.status).toBe("choose");
    expect(resolved.exerciseId).toBeNull();
    expect(resolved.candidateIds).toEqual([]);
    expect(resolved.availableIds).toEqual(["cable-press", "pushup"]);
  });
  it("uses a specific-exercise slot when it is available", () => {
    const [resolved] = resolveSlots({
      slots: [exerciseSlot("s1", "db-press")],
      exercises,
      locationEquipmentIds: ["dumbbells", "bench"],
      usage: noUsage,
    });
    expect(resolved).toMatchObject({
      status: "resolved",
      exerciseId: "db-press",
      candidateIds: ["db-press"],
    });
  });
  it("flags an unavailable specific exercise and offers same-movement substitutes", () => {
    const [resolved] = resolveSlots({
      slots: [exerciseSlot("s1", "bb-bench")],
      exercises,
      locationEquipmentIds: ["dumbbells", "bench"],
      usage: noUsage,
    });
    expect(resolved.status).toBe("unavailable");
    expect(resolved.exerciseId).toBeNull();
    expect(resolved.candidateIds).toEqual(["db-press", "pushup"]);
  });
  it("handles an unavailable specific exercise without a movement", () => {
    const [resolved] = resolveSlots({
      slots: [exerciseSlot("s1", "loner")],
      exercises: [exercise("loner", null, ["rare"])],
      locationEquipmentIds: [],
      usage: noUsage,
    });
    expect(resolved.status).toBe("unavailable");
    expect(resolved.candidateIds).toEqual([]);
  });
  it("treats a missing exercise as unavailable", () => {
    const [resolved] = resolveSlots({
      slots: [exerciseSlot("s1", "deleted")],
      exercises,
      locationEquipmentIds: ["dumbbells"],
      usage: noUsage,
    });
    expect(resolved.status).toBe("unavailable");
  });
  it("resolves every slot in order", () => {
    const resolved = resolveSlots({
      slots: [movementSlot("a", "press"), movementSlot("b", "biceps")],
      exercises,
      locationEquipmentIds: ["dumbbells", "bench"],
      usage: noUsage,
    });
    expect(resolved.map((slot) => slot.slotId)).toEqual(["a", "b"]);
    expect(resolved[1].exerciseId).toBe("curl");
  });
});
