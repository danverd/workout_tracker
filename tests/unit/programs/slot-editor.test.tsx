import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import {
  moveItem,
  repsMode,
  targetLabel,
  withRepsMode,
  type DraftSlot,
} from "@/features/programs/draft";
import { SlotEditor } from "@/features/programs/SlotEditor";

const movements = [{ id: "m1", name: "Horizontal press" }];
const exercises = [{ id: "e1", name: "Bench press", movementId: "m1" }];

const slot: DraftSlot = {
  id: "s1",
  movementId: "m1",
  exerciseId: null,
  targetSets: 3,
  repMin: 8,
  repMax: 12,
  amrap: false,
  notes: "",
};

function setup(initial: DraftSlot = slot) {
  const onSave = vi.fn();
  render(
    <SlotEditor
      slot={initial}
      movements={movements}
      exercises={exercises}
      onSave={onSave}
    />,
  );
  return onSave;
}

describe("SlotEditor reps modes", () => {
  it("starts in range mode for a range and shows min and max", () => {
    setup();
    expect(screen.getByLabelText("Min reps")).toHaveValue("8");
    expect(screen.getByLabelText("Max reps")).toHaveValue("12");
  });

  it("switches range to a single number, then to AMRAP", async () => {
    const onSave = setup();
    await userEvent.click(screen.getByRole("button", { name: "Fixed" }));
    expect(screen.queryByLabelText("Max reps")).not.toBeInTheDocument();
    expect(screen.getByLabelText("Reps")).toHaveValue("8");

    await userEvent.click(screen.getByRole("button", { name: "AMRAP" }));
    expect(screen.queryByLabelText("Reps")).not.toBeInTheDocument();
    expect(screen.getByText(/as many reps as you can/i)).toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "Save slot" }));
    expect(onSave).toHaveBeenCalledWith(
      expect.objectContaining({ amrap: true, repMin: null, repMax: null }),
    );
  });

  it("switches to a range with sensible defaults", async () => {
    const onSave = setup({ ...slot, repMin: 10, repMax: 10 });
    await userEvent.click(screen.getByRole("button", { name: "Range" }));
    expect(screen.getByLabelText("Min reps")).toHaveValue("10");
    expect(screen.getByLabelText("Max reps")).toHaveValue("14");
    await userEvent.click(screen.getByRole("button", { name: "Save slot" }));
    expect(onSave).toHaveBeenCalledWith(
      expect.objectContaining({ repMin: 10, repMax: 14, amrap: false }),
    );
  });

  it("blocks saving until a target is chosen and when the range is inverted", async () => {
    const onSave = setup({ ...slot, movementId: null });
    const save = screen.getByRole("button", { name: "Save slot" });
    expect(save).toBeDisabled();
    await userEvent.selectOptions(screen.getByLabelText("Movement"), "m1");
    expect(save).toBeEnabled();

    const max = screen.getByLabelText("Max reps");
    await userEvent.clear(max);
    await userEvent.type(max, "5");
    expect(screen.getByRole("alert")).toHaveTextContent(/at least min/i);
    expect(save).toBeDisabled();
    expect(onSave).not.toHaveBeenCalled();
  });

  it("switching to a specific exercise clears the movement and shows its movement", async () => {
    const onSave = setup();
    await userEvent.click(
      screen.getByRole("button", { name: "Specific exercise" }),
    );
    expect(screen.getByRole("button", { name: "Save slot" })).toBeDisabled();
    await userEvent.selectOptions(screen.getByLabelText("Exercise"), "e1");
    expect(
      screen.getByRole("option", { name: "Bench press · Horizontal press" }),
    ).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Save slot" }));
    expect(onSave).toHaveBeenCalledWith(
      expect.objectContaining({ exerciseId: "e1", movementId: null }),
    );
  });
});

describe("draft helpers", () => {
  it("derives and formats reps", () => {
    expect(repsMode(slot)).toBe("range");
    expect(targetLabel(slot)).toBe("3 × 8–12");
    expect(targetLabel(withRepsMode(slot, "number"))).toBe("3 × 8");
    expect(targetLabel(withRepsMode(slot, "amrap"))).toBe("3 × AMRAP");
  });

  it("moves items within bounds", () => {
    expect(moveItem([1, 2, 3], 1, -1)).toEqual([2, 1, 3]);
    expect(moveItem([1, 2, 3], 0, -1)).toEqual([1, 2, 3]);
    expect(moveItem([1, 2, 3], 2, 1)).toEqual([1, 2, 3]);
  });
});
