import { describe, expect, it } from "vitest";
import {
  formatDay,
  formatDuration,
  formatNumber,
  plural,
  round2,
} from "@/lib/format";

describe("lib/format", () => {
  it("pluralises", () => {
    expect(plural(1, "set")).toBe("1 set");
    expect(plural(0, "set")).toBe("0 sets");
    expect(plural(2, "program slot", "program slots")).toBe("2 program slots");
  });

  it("rounds to two decimals", () => {
    expect(round2(1.005 * 100)).toBe(100.5);
    expect(round2(12.3456)).toBe(12.35);
    expect(formatNumber(52.5)).toBe("52.5");
  });

  it("formats days and durations", () => {
    expect(formatDay("2026-10-30")).toBe("Fri, Oct 30");
    expect(formatDuration(null)).toBe("");
    expect(formatDuration(20)).toBe("1 min");
    expect(formatDuration(5400)).toBe("1 h 30 min");
    expect(formatDuration(7200)).toBe("2 h");
  });
});
