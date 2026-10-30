import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { QueueFlusher } from "@/lib/save-queue/QueueFlusher";
import { getBrowserQueue } from "@/lib/save-queue/browser";

describe("QueueFlusher", () => {
  it("renders nothing and reuses the singleton queue", () => {
    const before = getBrowserQueue();
    const { container, unmount } = render(<QueueFlusher />);
    expect(container).toBeEmptyDOMElement();
    unmount();
    render(<QueueFlusher />);
    expect(getBrowserQueue()).toBe(before);
  });
});
