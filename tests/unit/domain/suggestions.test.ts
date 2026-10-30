import { describe, expect, it } from "vitest";
import { suggestSets } from "@/lib/domain/suggestions";

const last = [
  { position: 0, weight: 50, reps: 10 },
  { position: 1, weight: 55, reps: 9 },
  { position: 2, weight: 60, reps: 8 },
];

describe("suggestSets", () => {
  it("leaves weights blank when the exercise was never done", () => {
    expect(suggestSets({ targetSets: 2, lastSets: [] })).toEqual([
      { weight: null, lastReps: null },
      { weight: null, lastReps: null },
    ]);
  });
  it("uses the weight per set position from last time", () => {
    expect(
      suggestSets({ targetSets: 3, lastSets: last }).map((s) => s.weight),
    ).toEqual([50, 55, 60]);
  });
  it("carries last time's reps for each position", () => {
    expect(
      suggestSets({ targetSets: 3, lastSets: last }).map((s) => s.lastReps),
    ).toEqual([10, 9, 8]);
  });
  it("repeats the last weight when there are more sets than before", () => {
    expect(
      suggestSets({ targetSets: 5, lastSets: last }).map((s) => s.weight),
    ).toEqual([50, 55, 60, 60, 60]);
  });
  it("truncates when there are fewer target sets", () => {
    expect(suggestSets({ targetSets: 1, lastSets: last })).toHaveLength(1);
    expect(suggestSets({ targetSets: 0, lastSets: last })).toEqual([]);
  });
  it("orders last sets by position", () => {
    expect(
      suggestSets({
        targetSets: 2,
        lastSets: [last[2], last[0]],
      }).map((s) => s.weight),
    ).toEqual([50, 60]);
  });
  it("snaps to the nearest available weight, ties down", () => {
    expect(
      suggestSets({
        targetSets: 2,
        lastSets: [
          { position: 0, weight: 85, reps: 8 },
          { position: 1, weight: 52.5, reps: 8 },
        ],
        weights: [40, 50, 60, 80],
      }).map((s) => s.weight),
    ).toEqual([80, 50]);
  });
  it("does not snap without a weight list", () => {
    expect(
      suggestSets({ targetSets: 1, lastSets: last, weights: [] })[0].weight,
    ).toBe(50);
    expect(
      suggestSets({ targetSets: 1, lastSets: last, weights: null })[0].weight,
    ).toBe(50);
  });
  it("keeps null reps from last time", () => {
    expect(
      suggestSets({
        targetSets: 1,
        lastSets: [{ position: 0, weight: 20, reps: null }],
      })[0],
    ).toEqual({ weight: 20, lastReps: null });
  });
});
