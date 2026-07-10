import { describe, expect, it } from "vitest";
import { effectiveWeight } from "@/lib/volume";

describe("effectiveWeight", () => {
  it("applies all specialized load rules", () => {
    expect(effectiveWeight("leg_press", 90)).toBe(316);
    expect(effectiveWeight("super_squats", 45)).toBe(165);
    expect(effectiveWeight("barbell", 50)).toBe(145);
    expect(effectiveWeight("dumbbell", 60)).toBe(120);
    expect(effectiveWeight("assisted", 100)).toBe(145);
    expect(effectiveWeight("cable_per_hand", 35)).toBe(70);
    expect(effectiveWeight("cable_per_arm", 20)).toBe(40);
    expect(effectiveWeight("bodyweight", 245)).toBe(0);
    expect(effectiveWeight("kettlebell", 35)).toBe(35);
  });

  it("never reports negative assisted weight", () =>
    expect(effectiveWeight("assisted", 300)).toBe(0));
});
