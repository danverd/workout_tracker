import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { ExerciseForm } from "@/features/setup/ExerciseForm";
import { NameListManager } from "@/features/setup/NameListManager";
import {
  applyRange,
  fromWeights,
  inferRange,
  toggleWeight,
  toWeights,
} from "@/features/setup/weight-list";

const apiPost = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
}));
vi.mock("@/lib/api", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/api")>()),
  apiPost: (...args: unknown[]) => apiPost(...args),
}));

beforeEach(() => {
  apiPost.mockReset();
});

describe("quick add", () => {
  it("adds on Enter and keeps the field focused and empty", async () => {
    apiPost.mockImplementation(
      async (_url: string, body: { name: string }) => ({
        id: body.name,
        name: body.name,
        hasWeights: false,
        usage: null,
      }),
    );
    render(<NameListManager kind="equipment" initialRows={[]} />);
    const input = screen.getByLabelText("Add equipment");
    await userEvent.type(input, "Dumbbells{Enter}");
    await userEvent.type(input, "Barbell{Enter}");

    expect(await screen.findByText("Dumbbells")).toBeInTheDocument();
    expect(await screen.findByText("Barbell")).toBeInTheDocument();
    expect(apiPost).toHaveBeenCalledWith("/api/equipment", {
      name: "Dumbbells",
    });
    expect(input).toHaveValue("");
    expect(input).toHaveFocus();
  });

  it("shows the server error and restores the text", async () => {
    const { ApiError } = await import("@/lib/api");
    apiPost.mockRejectedValue(new ApiError(409, "You already have that."));
    render(<NameListManager kind="movements" initialRows={[]} />);
    const input = screen.getByLabelText("Add movement");
    await userEvent.type(input, "Hinge{Enter}");
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "You already have that.",
    );
    expect(input).toHaveValue("Hinge");
  });
});

describe("exercise form", () => {
  it("Save and add another keeps selections, clears the name and refocuses", async () => {
    apiPost.mockResolvedValue({ id: "new" });
    render(
      <ExerciseForm
        movements={[{ id: "m1", name: "Horizontal press", usage: null }]}
        equipment={[
          { id: "e1", name: "Dumbbells", hasWeights: true, usage: null },
        ]}
      />,
    );
    await userEvent.type(screen.getByLabelText("Name"), "Incline press");
    await userEvent.click(
      screen.getByRole("button", { name: "Horizontal press" }),
    );
    const equipmentGroup = within(
      screen.getByRole("group", { name: "Required equipment" }),
    );
    await userEvent.click(
      equipmentGroup.getByRole("button", { name: "Dumbbells" }),
    );
    await userEvent.click(screen.getByRole("radio", { name: /Per hand/ }));
    await userEvent.click(
      screen.getByRole("button", { name: "Save and add another" }),
    );

    await waitFor(() => expect(screen.getByLabelText("Name")).toHaveValue(""));
    expect(apiPost).toHaveBeenCalledWith(
      "/api/exercises",
      expect.objectContaining({
        name: "Incline press",
        movementId: "m1",
        loadType: "per_hand",
        equipmentIds: ["e1"],
      }),
    );
    expect(screen.getByLabelText("Name")).toHaveFocus();
    expect(
      screen.getByRole("button", { name: "Horizontal press" }),
    ).toHaveAttribute("aria-pressed", "true");
    expect(
      equipmentGroup.getByRole("button", { name: "Dumbbells" }),
    ).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("status")).toHaveTextContent("Saved Incline press");
  });

  it("only shows base weight for per side", async () => {
    render(<ExerciseForm movements={[]} equipment={[]} />);
    expect(screen.queryByLabelText("Base weight")).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole("radio", { name: /Per side/ }));
    expect(screen.getByLabelText("Base weight")).toHaveValue("45");
  });
});

describe("weight list state", () => {
  it("expands a range, toggles weights off and saves the rest", () => {
    let state = applyRange({ min: 5, max: 25, step: 5 });
    expect(toWeights(state)).toEqual([5, 10, 15, 20, 25]);
    state = toggleWeight(state, 15);
    expect(toWeights(state)).toEqual([5, 10, 20, 25]);
    expect(toWeights({ ...state, mode: "none" })).toBeNull();
  });
});

describe("weight list from saved weights", () => {
  const gapped = [5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 60, 65, 70, 75, 80];
  it("infers min, max and the most common step", () => {
    expect(inferRange(gapped)).toEqual({ min: 5, max: 80, step: 5 });
    expect(inferRange([])).toBeNull();
  });
  it("brings removed weights back as toggled-off chips", () => {
    const state = fromWeights(gapped);
    expect(state.pool).toHaveLength(16);
    expect(state.off).toEqual([55]);
    expect(toWeights(state)).toEqual(gapped);
    expect(toWeights(toggleWeight(state, 55))).toContain(55);
  });
  it("keeps odd lists as they are", () => {
    expect(fromWeights([7, 10, 20])).toMatchObject({ off: [] });
  });
});
