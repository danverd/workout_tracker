import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { BottomSheet } from "@/ui/BottomSheet";

describe("BottomSheet", () => {
  it("renders nothing when closed", () => {
    render(
      <BottomSheet open={false} onClose={() => {}} title="Weight">
        content
      </BottomSheet>,
    );
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("is a named modal dialog and closes on Escape", async () => {
    const onClose = vi.fn();
    render(
      <BottomSheet open onClose={onClose} title="Set 1 weight">
        <button type="button">Inside</button>
      </BottomSheet>,
    );
    expect(
      screen.getByRole("dialog", { name: "Set 1 weight" }),
    ).toHaveAttribute("aria-modal", "true");
    await userEvent.keyboard("{Escape}");
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("closes on backdrop click and keeps focus inside on Tab", async () => {
    const onClose = vi.fn();
    render(
      <BottomSheet open onClose={onClose} title="Weight">
        <button type="button">Inside</button>
      </BottomSheet>,
    );
    for (let i = 0; i < 4; i++) await userEvent.tab();
    expect(screen.getByRole("dialog")).toContainElement(
      document.activeElement as HTMLElement,
    );
    await userEvent.click(screen.getByTestId("sheet-backdrop"));
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
