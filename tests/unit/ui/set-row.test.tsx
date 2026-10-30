import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { SetRow } from "@/ui/SetRow";

function setup(done = false) {
  const handlers = {
    onToggleDone: vi.fn(),
    onEditWeight: vi.fn(),
    onEditReps: vi.fn(),
  };
  render(<SetRow index={2} weight={50} reps={10} done={done} {...handlers} />);
  return handlers;
}

describe("SetRow", () => {
  it("fires onToggleDone from the done button", async () => {
    const { onToggleDone } = setup();
    await userEvent.click(screen.getByRole("button", { name: "Set 2 done" }));
    expect(onToggleDone).toHaveBeenCalledTimes(1);
  });

  it("exposes accessible names and pressed state", () => {
    setup(true);
    expect(screen.getByRole("group", { name: "Set 2" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Set 2 done" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    expect(
      screen.getByRole("button", { name: /Set 2 weight, 50 lb/ }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /Set 2 reps, 10/ }),
    ).toBeInTheDocument();
  });

  it("opens editors from the numerals", async () => {
    const { onEditWeight, onEditReps } = setup();
    await userEvent.click(screen.getByRole("button", { name: /weight/ }));
    await userEvent.click(screen.getByRole("button", { name: /reps/ }));
    expect(onEditWeight).toHaveBeenCalledTimes(1);
    expect(onEditReps).toHaveBeenCalledTimes(1);
  });
});
