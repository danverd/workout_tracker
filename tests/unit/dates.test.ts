import { describe, expect, it } from "vitest";
import {
  isDateOnly,
  monthBounds,
  todayInNewYork,
  weekBounds,
} from "@/lib/dates";
describe("date helpers", () => {
  it("uses New York calendar dates", () =>
    expect(todayInNewYork(new Date("2026-07-10T02:00:00Z"))).toBe(
      "2026-07-09",
    ));
  it("starts weeks on Monday", () =>
    expect(weekBounds("2026-07-12")).toEqual({
      start: "2026-07-06",
      end: "2026-07-12",
    }));
  it("finds month boundaries", () =>
    expect(monthBounds("2026-02-18")).toEqual({
      start: "2026-02-01",
      end: "2026-02-28",
    }));
  it("rejects invalid calendar dates", () => {
    expect(isDateOnly("2026-02-29")).toBe(false);
    expect(isDateOnly("2026-13-01")).toBe(false);
    expect(isDateOnly("2028-02-29")).toBe(true);
  });
});
