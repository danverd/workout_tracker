import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

const pathname = vi.hoisted(() => ({ current: "/" }));
vi.mock("next/navigation", () => ({ usePathname: () => pathname.current }));

import { TabBar } from "@/ui/TabBar";

describe("TabBar", () => {
  it("marks only the active tab with aria-current", () => {
    pathname.current = "/history/exercise/12";
    render(<TabBar />);
    expect(screen.getByRole("link", { name: "History" })).toHaveAttribute(
      "aria-current",
      "page",
    );
    for (const name of ["Today", "Programs", "Setup"]) {
      expect(screen.getByRole("link", { name })).not.toHaveAttribute(
        "aria-current",
      );
    }
  });

  it("only matches Today on the root path and links to each tab", () => {
    pathname.current = "/";
    render(<TabBar />);
    expect(screen.getByRole("link", { name: "Today" })).toHaveAttribute(
      "aria-current",
      "page",
    );
    expect(screen.getByRole("link", { name: "Programs" })).toHaveAttribute(
      "href",
      "/programs",
    );
    expect(screen.getByRole("link", { name: "Setup" })).toHaveAttribute(
      "href",
      "/setup",
    );
  });
});
