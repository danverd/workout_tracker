import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { SessionLogger } from "@/features/session/SessionLogger";
import type { Catalog } from "@/features/session/catalog";
import type { LoggerSession } from "@/features/session/state";
import { createSaveQueue } from "@/lib/save-queue/queue";
import type { Mutation } from "@/lib/save-queue/types";

vi.mock("next/navigation", () => ({ usePathname: () => "/session/s1" }));

const U = (n: number) =>
  `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const SESSION = U(1);
const LOCATION = U(2);
const PRESS = U(3);
const ROW_LAST = U(4);
const ROW_TARGET = U(5);
const SLOT = U(6);
const EQUIPMENT = U(7);

const catalog: Catalog = {
  locations: [
    {
      id: LOCATION,
      name: "Home",
      archived: false,
      equipment: [{ equipmentId: EQUIPMENT, weights: [40, 45, 50, 55] }],
    },
  ],
  exercises: [
    {
      id: PRESS,
      name: "Incline press",
      movementId: null,
      loadType: "per_hand",
      baseWeight: 0,
      weightEquipmentId: EQUIPMENT,
      increment: 5,
      archived: false,
      equipmentIds: [EQUIPMENT],
    },
    {
      id: U(8),
      name: "Curl",
      movementId: null,
      loadType: "per_hand",
      baseWeight: 0,
      weightEquipmentId: null,
      increment: 5,
      archived: false,
      equipmentIds: [],
    },
  ],
  movements: [],
  programs: [],
  settings: {
    bodyweightLb: 180,
    activeProgramId: null,
    lastLocationId: LOCATION,
  },
  nextDayByProgram: {},
  lastUsedAnywhere: {},
  lastUsedByLocation: {},
  // Last time: set 1 got 10 reps, set 2 got 9.
  lastSets: {
    [PRESS]: [
      { position: 0, weight: 50, reps: 10 },
      { position: 1, weight: 50, reps: 9 },
    ],
  },
};

function row(
  id: string,
  name: string,
  slotId: string | null,
  exerciseId: string,
) {
  return {
    id,
    sessionId: SESSION,
    exerciseId,
    slotId,
    position: id === ROW_LAST ? 0 : 1,
    name,
    loadType: "per_hand" as const,
    baseWeight: 0,
    sets: [0, 1].map((position) => ({
      id: U(position + (id === ROW_LAST ? 20 : 30)),
      sessionExerciseId: id,
      position,
      weight: 50,
      reps: null,
      done: false,
      volume: 0,
    })),
  };
}

const initial: LoggerSession = {
  id: SESSION,
  date: "2026-10-30",
  kind: "strength",
  locationId: LOCATION,
  programId: null,
  programDayId: null,
  title: "Freestyle",
  dayName: "Push",
  bodyweightLb: 180,
  notes: "",
  startedAt: "2026-10-30T10:00:00.000Z",
  finishedAt: null,
  exercises: [
    row(ROW_LAST, "Incline press", null, PRESS),
    // No history; its slot says 8–12 reps.
    row(ROW_TARGET, "Curl", SLOT, U(8)),
  ],
};
const targets = { [SLOT]: { sets: 3, repMin: 8, repMax: 12, amrap: false } };

function setup() {
  const sent: Mutation[] = [];
  const queue = createSaveQueue({
    send: async (mutation) => {
      sent.push(mutation);
    },
  });
  render(
    <SessionLogger
      initial={initial}
      catalog={catalog}
      targets={targets}
      queue={queue}
    />,
  );
  return { sent, queue, user: userEvent.setup() };
}

const section = (name: string) => within(screen.getByRole("region", { name }));

afterEach(cleanup);

describe("SessionLogger done toggle", () => {
  it("fills reps from last time's matching set", async () => {
    const { user, sent } = setup();
    const press = section("Incline press");
    await user.click(press.getAllByRole("button", { name: "Set 1 done" })[0]);
    await user.click(press.getAllByRole("button", { name: "Set 2 done" })[0]);

    expect(
      press.getByRole("button", { name: "Set 1 reps, 10. Edit" }),
    ).toBeInTheDocument();
    expect(
      press.getByRole("button", { name: "Set 2 reps, 9. Edit" }),
    ).toBeInTheDocument();
    expect(press.getByRole("button", { name: "Set 1 done" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    await vi.waitFor(() => expect(sent).toHaveLength(2));
    expect(sent[0]).toMatchObject({
      type: "putSet",
      exerciseId: ROW_LAST,
      set: { weight: 50, reps: 10, done: true },
    });
  });

  it("falls back to the slot's target reps with no history", async () => {
    const { user } = setup();
    const curl = section("Curl");
    await user.click(curl.getByRole("button", { name: "Set 1 done" }));
    expect(
      curl.getByRole("button", { name: "Set 1 reps, 8. Edit" }),
    ).toBeInTheDocument();
  });

  it("keeps reps the owner already entered and after un-doing", async () => {
    const { user } = setup();
    const press = section("Incline press");
    await user.click(
      press.getByRole("button", { name: "Set 1 reps, not set. Edit" }),
    );
    const sheet = within(screen.getByRole("dialog"));
    await user.click(sheet.getByRole("button", { name: "Increase reps" }));
    await user.click(sheet.getByRole("button", { name: "Done" }));

    await user.click(press.getByRole("button", { name: "Set 1 done" }));
    expect(
      press.getByRole("button", { name: "Set 1 reps, 1. Edit" }),
    ).toBeInTheDocument();

    await user.click(press.getByRole("button", { name: "Set 1 done" }));
    expect(press.getByRole("button", { name: "Set 1 done" })).toHaveAttribute(
      "aria-pressed",
      "false",
    );
    expect(
      press.getByRole("button", { name: "Set 1 reps, 1. Edit" }),
    ).toBeInTheDocument();
  });
});

describe("SessionLogger editing", () => {
  it("steps weight and adds a set copying the previous weight", async () => {
    const { user, sent } = setup();
    const press = section("Incline press");
    await user.click(
      press.getByRole("button", { name: "Set 2 weight, 50 lb. Edit" }),
    );
    const sheet = within(screen.getByRole("dialog"));
    await user.click(sheet.getByRole("button", { name: "Increase weight" }));
    await user.click(sheet.getByRole("button", { name: "Done" }));
    expect(
      press.getByRole("button", { name: "Set 2 weight, 55 lb. Edit" }),
    ).toBeInTheDocument();

    await user.click(press.getByRole("button", { name: "+ Add set" }));
    expect(
      press.getByRole("button", { name: "Set 3 weight, 55 lb. Edit" }),
    ).toBeInTheDocument();
    await vi.waitFor(() => expect(sent.length).toBeGreaterThanOrEqual(2));
  });

  it("finishes and reopens", async () => {
    const { user, sent } = setup();
    await user.click(screen.getByRole("button", { name: "Finish" }));
    expect(screen.getByText("Session finished")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Reopen" }));
    expect(screen.queryByText("Session finished")).not.toBeInTheDocument();
    await vi.waitFor(() =>
      expect(sent.map((m) => m.type)).toEqual(["finish", "reopen"]),
    );
  });

  it("shows the title with the location", () => {
    setup();
    expect(
      screen.getByRole("heading", { level: 1, name: "Push · Home" }),
    ).toBeInTheDocument();
  });
});
