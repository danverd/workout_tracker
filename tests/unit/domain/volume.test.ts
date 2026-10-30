import { describe, expect, it } from "vitest";
import { effectiveWeight, setVolume } from "@/lib/domain/volume";
import type { LoadType } from "@/types/domain";

const base = { baseWeight: 0, bodyweightLb: 180 };
const input = (loadType: LoadType, weight: number, extra = {}) => ({
  loadType,
  weight,
  ...base,
  ...extra,
});

describe("effectiveWeight", () => {
  it("counts total weight as entered", () => {
    expect(effectiveWeight(input("total", 100))).toBe(100);
  });
  it("doubles per-hand weight", () => {
    expect(effectiveWeight(input("per_hand", 50))).toBe(100);
  });
  it("adds the base to two sides of plates", () => {
    expect(effectiveWeight(input("per_side", 45, { baseWeight: 45 }))).toBe(
      135,
    );
    expect(effectiveWeight(input("per_side", 0, { baseWeight: 45 }))).toBe(45);
  });
  it("subtracts assistance from bodyweight and never goes negative", () => {
    expect(effectiveWeight(input("assisted", 60))).toBe(120);
    expect(effectiveWeight(input("assisted", 250))).toBe(0);
  });
  it("adds weight to bodyweight", () => {
    expect(effectiveWeight(input("bodyweight", 0))).toBe(180);
    expect(effectiveWeight(input("bodyweight", 25))).toBe(205);
  });
});

describe("setVolume", () => {
  it("multiplies effective weight by reps for done sets", () => {
    expect(setVolume({ ...input("per_hand", 50), reps: 10, done: true })).toBe(
      1000,
    );
  });
  it("counts nothing for sets that are not done", () => {
    expect(setVolume({ ...input("total", 100), reps: 10, done: false })).toBe(
      0,
    );
  });
  it("counts nothing without reps", () => {
    expect(setVolume({ ...input("total", 100), reps: null, done: true })).toBe(
      0,
    );
    expect(setVolume({ ...input("total", 100), reps: 0, done: true })).toBe(0);
  });
  it("uses bodyweight for bodyweight movements", () => {
    expect(setVolume({ ...input("bodyweight", 0), reps: 8, done: true })).toBe(
      1440,
    );
  });
  it("rounds away floating point noise", () => {
    expect(setVolume({ ...input("total", 0.1), reps: 3, done: true })).toBe(
      0.3,
    );
  });
});
