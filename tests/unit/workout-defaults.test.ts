import { describe, expect, it } from "vitest";
import {
  mapHistoricalWeights,
  makeWorkoutFromTemplate,
} from "@/lib/workout-defaults";
describe("workout defaults", () => {
  it("repeats the last historical set and ignores extras", () => {
    expect(mapHistoricalWeights([1, 2, 3, 4], [90, 100])).toEqual([
      90, 100, 100, 100,
    ]);
    expect(mapHistoricalWeights([1, 2], [90, 100, 110])).toEqual([90, 100]);
  });
  it("falls back to per-set baselines", () =>
    expect(mapHistoricalWeights([80, 100], [])).toEqual([80, 100]));
  it("applies prior exercise history across templates", () => {
    const workout = makeWorkoutFromTemplate("2026-07-10", "leg-day-1", {
      "seated-hamstring-curls": [125],
    });
    expect(workout.exercises[0].sets.map((set) => set.inputWeight)).toEqual([
      125, 125, 125, 125,
    ]);
  });
});
