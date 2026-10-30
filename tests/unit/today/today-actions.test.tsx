import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { TodayActions } from "@/features/today/today-actions";
import type { SessionSummaryDto } from "@/types/domain";

const base: SessionSummaryDto = {
  id: "11111111-1111-4111-8111-111111111111",
  date: "2026-10-30",
  kind: "strength",
  title: "Push · Home",
  dayName: "Push",
  locationId: null,
  locationName: "Home",
  startedAt: "2026-10-30T12:00:00.000Z",
  finishedAt: null,
  exerciseCount: 3,
  doneSetCount: 2,
  totalVolume: 1200,
  cardio: null,
};

describe("TodayActions", () => {
  it("offers Start lifting as the primary action with no sessions", () => {
    render(<TodayActions sessions={[]} />);
    expect(screen.getByRole("link", { name: "Start lifting" })).toHaveAttribute(
      "href",
      "/session/new",
    );
    expect(screen.getByRole("link", { name: "Log cardio" })).toHaveAttribute(
      "href",
      "/cardio/new",
    );
  });

  it("switches to Continue when a strength session is in progress", () => {
    render(<TodayActions sessions={[base]} />);
    expect(
      screen.getByRole("link", { name: "Continue Push · Home" }),
    ).toHaveAttribute("href", `/session/${base.id}`);
    expect(screen.queryByRole("link", { name: "Start lifting" })).toBeNull();
  });

  it("keeps Start lifting when today's sessions are finished or cardio", () => {
    const finished = { ...base, finishedAt: "2026-10-30T13:00:00.000Z" };
    const cardio = { ...base, id: "x", kind: "cardio" as const };
    render(<TodayActions sessions={[finished, cardio]} />);
    expect(
      screen.getByRole("link", { name: "Start lifting" }),
    ).toBeInTheDocument();
    expect(screen.queryByText(/Continue/)).toBeNull();
  });
});
