import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { Stepper } from "@/ui/Stepper";

describe("Stepper", () => {
  it("increments and decrements by the increment", async () => {
    const onChange = vi.fn();
    render(
      <Stepper label="Weight" value={50} increment={2.5} onChange={onChange} />,
    );
    await userEvent.click(
      screen.getByRole("button", { name: "Increase weight" }),
    );
    expect(onChange).toHaveBeenLastCalledWith(52.5);
    await userEvent.click(
      screen.getByRole("button", { name: "Decrease weight" }),
    );
    expect(onChange).toHaveBeenLastCalledWith(47.5);
  });

  it("selects a value from the chips", async () => {
    const onChange = vi.fn();
    render(
      <Stepper
        label="Weight"
        value={50}
        increment={5}
        options={[40, 45, 50, 55]}
        onChange={onChange}
      />,
    );
    expect(screen.getByRole("button", { name: "50" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    await userEvent.click(screen.getByRole("button", { name: "55" }));
    expect(onChange).toHaveBeenCalledWith(55);
  });

  it("clamps at min and disables decrease there", async () => {
    const onChange = vi.fn();
    render(
      <Stepper
        label="Reps"
        value={2}
        increment={5}
        min={1}
        onChange={onChange}
      />,
    );
    await userEvent.click(
      screen.getByRole("button", { name: "Decrease reps" }),
    );
    expect(onChange).toHaveBeenCalledWith(1);

    onChange.mockClear();
    render(
      <Stepper
        label="Sets"
        value={1}
        increment={1}
        min={1}
        onChange={onChange}
      />,
    );
    const decrease = screen.getByRole("button", { name: "Decrease sets" });
    expect(decrease).toBeDisabled();
  });

  it("accepts typed values from the keypad field, clamped to min", async () => {
    const onChange = vi.fn();
    render(
      <Stepper
        label="Reps"
        value={8}
        increment={1}
        min={1}
        onChange={onChange}
      />,
    );
    const field = screen.getByLabelText("Type reps");
    await userEvent.clear(field);
    await userEvent.type(field, "0");
    expect(onChange).toHaveBeenLastCalledWith(1);
  });

  it("steps to the next and previous available weight when options exist", async () => {
    const onChange = vi.fn();
    render(
      <Stepper
        label="Weight"
        value={20}
        increment={5}
        options={[10, 20, 35, 50]}
        onChange={onChange}
      />,
    );
    await userEvent.click(
      screen.getByRole("button", { name: "Increase weight" }),
    );
    expect(onChange).toHaveBeenLastCalledWith(35);
    await userEvent.click(
      screen.getByRole("button", { name: "Decrease weight" }),
    );
    expect(onChange).toHaveBeenLastCalledWith(10);
  });

  it("stays put at the heaviest available weight", async () => {
    const onChange = vi.fn();
    render(
      <Stepper
        label="Weight"
        value={50}
        increment={5}
        options={[10, 20, 35, 50]}
        onChange={onChange}
      />,
    );
    await userEvent.click(
      screen.getByRole("button", { name: "Increase weight" }),
    );
    expect(onChange).toHaveBeenLastCalledWith(50);
  });
});
