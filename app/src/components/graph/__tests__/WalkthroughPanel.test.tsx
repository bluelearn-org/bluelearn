// @vitest-environment jsdom
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { Walkthrough } from "@bluelearn/schemas";
import { WalkthroughPanel } from "@/components/graph/WalkthroughPanel";

vi.mock("@tanstack/react-router", () => ({
  Link: ({
    children,
    to,
    className,
  }: {
    children: React.ReactNode;
    to: string;
    className?: string;
  }) => (
    <a href={to} className={className}>
      {children}
    </a>
  ),
}));

const longSummary = "Limits and continuity. ".repeat(200).trim();

const node: Walkthrough["nodes"][number] = {
  id: "node-1",
  slug: "calc-intro",
  title: "Calculus Introduction",
  level: 1,
  summary: longSummary,
  duration_minutes: 30,
  tags: [{ slug: "math", name: "Mathematics" }],
};

const guideProps = { node, targetSlug: "calc-intro", targetTitle: "Calculus" };

afterEach(cleanup);

describe("WalkthroughPanel on desktop", () => {
  it("renders the in-flow aside with no sheet or dialog", () => {
    const { container } = render(<WalkthroughPanel {...guideProps} />);

    expect(screen.queryByRole("dialog")).toBeNull();
    expect(container.querySelector("[data-slot=sheet-content]")).toBeNull();
    expect(container.querySelector("aside")).not.toBeNull();
    expect(
      screen.getByRole("heading", { level: 2, name: "Calculus Introduction" })
    ).toBeDefined();
    expect(screen.getByRole("link", { name: "Open Guide" })).toBeDefined();
    expect(screen.queryByRole("button")).toBeNull();
  });

  it("keeps the collapse button when onClose is given", () => {
    const onClose = vi.fn();
    render(
      <WalkthroughPanel
        node={node}
        objective={{ slug: "calculus", title: "Calculus" }}
        guideSlug="calc-intro"
        isRequest={false}
        preview={false}
        onClose={onClose}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: "Close panel" }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});

describe("WalkthroughPanel as a mobile sheet", () => {
  const open = (onClose = vi.fn()) =>
    render(
      <>
        <button>Outside</button>
        <WalkthroughPanel
          {...guideProps}
          mobileSheet={{ open: true, onClose }}
        />
      </>
    );

  it("renders nothing while closed", () => {
    render(
      <WalkthroughPanel
        {...guideProps}
        mobileSheet={{ open: false, onClose: vi.fn() }}
      />
    );

    expect(screen.queryByRole("dialog")).toBeNull();
    expect(screen.queryByRole("link", { name: "Open Guide" })).toBeNull();
  });

  it("is a dialog named by the guide title", () => {
    open();

    expect(
      screen.getByRole("dialog", { name: "Calculus Introduction" })
    ).toBeDefined();
  });

  it("moves focus into the dialog and hides the background", async () => {
    open();

    const dialog = screen.getByRole("dialog");
    await waitFor(() =>
      expect(dialog.contains(document.activeElement)).toBe(true)
    );
    expect(screen.queryByRole("button", { name: "Outside" })).toBeNull();
  });

  it("closes from the X button, which is at least 44x44px", () => {
    const onClose = vi.fn();
    open(onClose);

    const close = screen.getByRole("button", { name: "Close guide panel" });
    expect(close.className).toContain("size-11");

    fireEvent.click(close);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("closes on Escape", () => {
    const onClose = vi.fn();
    open(onClose);

    fireEvent.keyDown(screen.getByRole("dialog"), { key: "Escape" });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("scrolls a long summary in its own area and pins Open Guide outside it", () => {
    open();

    const scroller = screen.getByText(longSummary).closest(".overflow-y-auto");
    expect(scroller).not.toBeNull();
    expect(scroller?.className).toContain("min-h-0");

    const link = screen.getByRole("link", { name: "Open Guide" });
    expect(scroller?.contains(link)).toBe(false);
    expect(link.parentElement?.className).toContain(
      "env(safe-area-inset-bottom)"
    );
  });

  it("describes the dialog with the summary", () => {
    open();

    expect(screen.getByRole("dialog").getAttribute("aria-describedby")).toBe(
      screen.getByText(longSummary).id
    );
  });
});
