import { describe, expect, it } from "vitest";
import {
  expandRange,
  nextWeight,
  previousWeight,
  snapToNearest,
} from "@/lib/domain/weights";

describe("expandRange", () => {
  it("expands min/max/step inclusively", () => {
    expect(expandRange({ min: 5, max: 25, step: 5 })).toEqual([
      5, 10, 15, 20, 25,
    ]);
  });
  it("drops a last step that overshoots max", () => {
    expect(expandRange({ min: 5, max: 22, step: 5 })).toEqual([5, 10, 15, 20]);
  });
  it("handles fractional steps without float noise", () => {
    expect(expandRange({ min: 2.5, max: 10, step: 2.5 })).toEqual([
      2.5, 5, 7.5, 10,
    ]);
    expect(expandRange({ min: 0.1, max: 0.5, step: 0.1 })).toEqual([
      0.1, 0.2, 0.3, 0.4, 0.5,
    ]);
  });
  it("returns a single value when min equals max", () => {
    expect(expandRange({ min: 45, max: 45, step: 5 })).toEqual([45]);
  });
  it("returns an empty list for invalid ranges", () => {
    expect(expandRange({ min: 10, max: 5, step: 5 })).toEqual([]);
    expect(expandRange({ min: 5, max: 50, step: 0 })).toEqual([]);
    expect(expandRange({ min: 5, max: 50, step: -5 })).toEqual([]);
    expect(expandRange({ min: 0, max: 1e9, step: 1 })).toEqual([]);
    expect(expandRange({ min: NaN, max: 5, step: 1 })).toEqual([]);
  });
});

describe("snapToNearest", () => {
  const dumbbells = [5, 10, 15, 20, 80];
  it("returns an exact match", () => {
    expect(snapToNearest(dumbbells, 15)).toBe(15);
  });
  it("snaps to the nearest weight", () => {
    expect(snapToNearest(dumbbells, 16)).toBe(15);
    expect(snapToNearest(dumbbells, 18)).toBe(20);
  });
  it("rounds ties down", () => {
    expect(snapToNearest(dumbbells, 12.5)).toBe(10);
    expect(snapToNearest([30, 40], 35)).toBe(30);
    expect(snapToNearest([40, 30], 35)).toBe(30);
  });
  it("snaps above and below the range", () => {
    expect(snapToNearest(dumbbells, 85)).toBe(80);
    expect(snapToNearest(dumbbells, 1)).toBe(5);
  });
  it("returns the target for an empty list", () => {
    expect(snapToNearest([], 42)).toBe(42);
  });
});

describe("nextWeight / previousWeight", () => {
  const options = { weights: [5, 10, 20, 25], increment: 2.5 };
  it("steps through the available list", () => {
    expect(nextWeight(10, options)).toBe(20);
    expect(previousWeight(20, options)).toBe(10);
  });
  it("steps from an off-list weight to the adjacent list entries", () => {
    expect(nextWeight(12, options)).toBe(20);
    expect(previousWeight(12, options)).toBe(10);
  });
  it("stays put at the ends of the list", () => {
    expect(nextWeight(25, options)).toBe(25);
    expect(previousWeight(5, options)).toBe(5);
  });
  it("uses the increment without a list", () => {
    expect(nextWeight(100, { increment: 5 })).toBe(105);
    expect(nextWeight(100, { weights: null, increment: 2.5 })).toBe(102.5);
    expect(nextWeight(100, { weights: [], increment: 5 })).toBe(105);
    expect(previousWeight(100, { increment: 5 })).toBe(95);
  });
  it("never goes below zero", () => {
    expect(previousWeight(2, { increment: 5 })).toBe(0);
    expect(previousWeight(0, { increment: 5 })).toBe(0);
  });
});
