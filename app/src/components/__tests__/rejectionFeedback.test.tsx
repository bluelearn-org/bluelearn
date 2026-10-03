// @vitest-environment jsdom
import {
  cleanup,
  fireEvent,
  render,
  screen,
  within,
} from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { RejectionFeedback } from "@/components/review/RejectionFeedback";

vi.mock("@tanstack/react-router", () => ({
  Link: ({ children }: { children: React.ReactNode }) => <a>{children}</a>,
}));

vi.mock("@/lib/api/guideRevisions", () => ({
  getRevision: vi.fn(() => Promise.resolve({ revised_from_case_id: "case-1" })),
}));

vi.mock("@/lib/api/reviews", () => ({
  getReviewCase: vi.fn(() =>
    Promise.resolve({
      decisions: [
        {
          id: "d1",
          decision: "reject",
          notes: "Needs a worked example.",
          reasons: ["clarity_issue"],
          created_at: "2026-10-01T00:00:00Z",
          member_username: "reviewer",
        },
      ],
    })
  ),
}));

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

const stubScreen = (isDesktop: boolean) => {
  vi.stubGlobal(
    "ResizeObserver",
    class {
      observe() {}
      unobserve() {}
      disconnect() {}
    }
  );
  vi.stubGlobal("matchMedia", (query: string) => ({
    matches: isDesktop,
    media: query,
    addEventListener: () => {},
    removeEventListener: () => {},
  }));
};

describe("RejectionFeedback", () => {
  it("opens the panel feedback in a sheet on mobile", async () => {
    stubScreen(false);
    render(<RejectionFeedback draftId="draft-1" />);

    fireEvent.click(
      await screen.findByRole("button", { name: "Show panel feedback" })
    );

    const dialog = screen.getByRole("dialog");
    expect(within(dialog).getByText("View the closed case")).toBeDefined();
    expect(within(dialog).getByText("Needs a worked example.")).toBeDefined();
  });

  it("reopens the side column instead of a sheet on desktop", async () => {
    stubScreen(true);
    render(<RejectionFeedback draftId="draft-1" />);

    fireEvent.click(
      await screen.findByRole("button", { name: "Hide panel feedback" })
    );
    fireEvent.click(
      screen.getByRole("button", { name: "Show panel feedback" })
    );

    expect(screen.queryByRole("dialog")).toBeNull();
    // the column is back, so the reopen button hides again
    expect(
      screen.getByLabelText("Show panel feedback").getAttribute("aria-hidden")
    ).toBe("true");
  });
});
