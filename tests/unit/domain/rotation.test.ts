import { describe, expect, it } from "vitest";
import { nextProgramDay } from "@/lib/domain/rotation";

const days = [{ id: "push" }, { id: "pull" }, { id: "legs" }];
const session = (
  programDayId: string | null,
  date: string,
  doneSetCount = 3,
  startedAt = `${date}T10:00:00Z`,
  programId: string | null = "ppl",
) => ({ programId, programDayId, date, startedAt, doneSetCount });

describe("nextProgramDay", () => {
  it("returns null for a program without days", () => {
    expect(nextProgramDay([], [])).toBeNull();
  });
  it("starts at the first day with no sessions", () => {
    expect(nextProgramDay(days, [])).toBe("push");
  });
  it("advances to the day after the latest session", () => {
    expect(nextProgramDay(days, [session("push", "2026-10-01")])).toBe("pull");
  });
  it("wraps around after the last day", () => {
    expect(nextProgramDay(days, [session("legs", "2026-10-01")])).toBe("push");
  });
  it("uses the most recent session regardless of order", () => {
    expect(
      nextProgramDay(days, [
        session("pull", "2026-10-03"),
        session("push", "2026-10-01"),
        session("legs", "2026-10-02"),
      ]),
    ).toBe("legs");
  });
  it("breaks same-date ties by start time", () => {
    expect(
      nextProgramDay(days, [
        session("push", "2026-10-01", 3, "2026-10-01T08:00:00Z"),
        session("pull", "2026-10-01", 3, "2026-10-01T18:00:00Z"),
      ]),
    ).toBe("legs");
  });
  it("ignores sessions with no done sets", () => {
    expect(
      nextProgramDay(days, [
        session("push", "2026-10-01"),
        session("pull", "2026-10-02", 0),
      ]),
    ).toBe("pull");
  });
  it("ignores freestyle sessions that have no program day", () => {
    expect(
      nextProgramDay(days, [
        session("push", "2026-10-01"),
        session(null, "2026-10-02", 3, "2026-10-02T10:00:00Z", null),
      ]),
    ).toBe("pull");
  });
  it("falls back to the first day if the last day was deleted", () => {
    expect(nextProgramDay(days, [session("gone", "2026-10-01")])).toBe("push");
  });
  it("follows the current day order", () => {
    const reordered = [{ id: "legs" }, { id: "push" }, { id: "pull" }];
    expect(nextProgramDay(reordered, [session("push", "2026-10-01")])).toBe(
      "pull",
    );
  });
});
