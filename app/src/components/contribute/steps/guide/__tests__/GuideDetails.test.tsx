// @vitest-environment jsdom
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  within,
} from "@testing-library/react";
import { useState } from "react";
import { afterEach, describe, expect, it, onTestFinished, vi } from "vitest";
import type { ReactNode } from "react";

import type { GuideContribution } from "@/types/contributions";

import { GuideDetails } from "@/components/contribute/steps/guide/GuideDetails";
import { Route } from "@/routes/guides/$slug/$variantSlug/edit";

const { useLoaderData } = vi.hoisted(() => ({
  useLoaderData: vi.fn(),
}));

vi.mock("@tanstack/react-router", () => ({
  Link: ({ children }: { children: ReactNode }) => <a>{children}</a>,
  createFileRoute: () => (options: object) => ({
    options,
    useLoaderData,
    useParams: () => ({ slug: "binary-search", variantSlug: "official" }),
  }),
  notFound: vi.fn(),
  useRouter: () => ({ invalidate: vi.fn() }),
}));

vi.mock("@stepperize/react", () => ({
  defineStepper: () => ({
    Stepper: {
      Root: ({ children }: { children: () => ReactNode }) => children(),
      List: () => null,
      Content: ({ children }: { children: ReactNode }) => children,
    },
  }),
}));

vi.mock("@/lib/auth", () => ({ requireSession: vi.fn() }));
vi.mock("@/lib/authContext", () => ({
  useSuspensionStatus: () => "active",
}));
vi.mock("@/lib/api/guides", () => ({
  listGuides: () => Promise.resolve([]),
}));
vi.mock("@/lib/api/subjects", () => ({
  listSubjects: () => Promise.resolve([]),
}));
vi.mock("@/lib/api/identity", () => ({
  getMyIdentity: () => Promise.resolve({ profile: { username: "editor" } }),
}));
vi.mock("@/lib/api/guideRevisions", () => ({
  getRevision: vi.fn(),
  updateRevision: vi.fn(),
  submitRevision: vi.fn(),
}));
vi.mock("@/lib/api/variants", () => ({
  getVariantBySlug: vi.fn(),
  createVariantRevision: vi.fn(),
}));
vi.mock("@/lib/api/media", () => ({ uploadMedia: vi.fn() }));
vi.mock("@/components/contribute/StepperActionHeader", () => ({
  StepperActionHeader: () => null,
}));
vi.mock("@/components/contribute/MobileStepProgress", () => ({
  MobileStepProgress: () => null,
}));
vi.mock("@/components/contribute/steps/Content", () => ({
  Content: () => null,
}));
vi.mock("@/components/contribute/steps/Submit", () => ({
  Submit: () => null,
}));
vi.mock("@/components/review/RejectionFeedback", () => ({
  RejectionFeedback: () => null,
}));

const guide: GuideContribution = {
  type: "theoretical",
  title: "Binary search",
  summary: "Find a value in sorted data.",
  body: "",
  subjects: [],
  newSubjects: [],
  prereqs: [],
  requests: [],
  disclaimers: [],
};

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("GuideDetails when editing a guide", () => {
  it("shows the change summary above the title when base fields are hidden", () => {
    const onChangeSummaryChange = vi.fn();

    render(
      <GuideDetails
        type="variant"
        guideContData={guide}
        onGuideChange={() => {}}
        subjects={[]}
        guides={[]}
        onSaveDraft={() => {}}
        showBaseFields={false}
        changeSummary="Clarify the example"
        onChangeSummaryChange={onChangeSummaryChange}
      />
    );

    const changeSummaryLabel = screen.getByText("Change Summary");
    const titleLabel = screen.getByText("Title");
    expect(
      changeSummaryLabel.compareDocumentPosition(titleLabel) &
        Node.DOCUMENT_POSITION_FOLLOWING
    ).toBeTruthy();

    const changeSummary = screen.getByPlaceholderText("Describe what changed.");
    expect((changeSummary as HTMLTextAreaElement).value).toBe(
      "Clarify the example"
    );

    fireEvent.change(changeSummary, {
      target: { value: "Explain the edge case" },
    });
    expect(onChangeSummaryChange).toHaveBeenCalledWith("Explain the edge case");
  });

  it.each([true, false])(
    "selects, removes, restores, and isolates disclaimers for the active draft (showBaseFields=%s)",
    (showBaseFields) => {
      vi.stubGlobal(
        "ResizeObserver",
        class {
          observe() {}
          unobserve() {}
          disconnect() {}
        }
      );
      const scrollDescriptor = Object.getOwnPropertyDescriptor(
        Element.prototype,
        "scrollIntoView"
      );
      Object.defineProperty(Element.prototype, "scrollIntoView", {
        configurable: true,
        value: vi.fn(),
      });
      onTestFinished(() => {
        if (scrollDescriptor) {
          Object.defineProperty(
            Element.prototype,
            "scrollIntoView",
            scrollDescriptor
          );
        } else {
          Reflect.deleteProperty(Element.prototype, "scrollIntoView");
        }
      });
      const firstGuide: GuideContribution = {
        ...guide,
        disclaimers: ["medical"],
      };
      const secondGuide: GuideContribution = {
        ...guide,
        title: "Graph traversal",
        disclaimers: [],
      };

      const Harness = () => {
        const [active, setActive] = useState<"first" | "second">("first");
        const [first, setFirst] = useState(firstGuide);
        const [second, setSecond] = useState(secondGuide);
        const activeGuide = active === "first" ? first : second;
        const setActiveGuide = active === "first" ? setFirst : setSecond;

        return (
          <>
            <button
              type="button"
              onClick={() =>
                setActive((current) =>
                  current === "first" ? "second" : "first"
                )
              }
            >
              Switch guide
            </button>
            <GuideDetails
              type="guide"
              guideContData={activeGuide}
              onGuideChange={(update) =>
                setActiveGuide((current) => ({ ...current, ...update }))
              }
              subjects={[]}
              guides={[]}
              onSaveDraft={() => {}}
              showBaseFields={showBaseFields}
            />
          </>
        );
      };

      render(<Harness />);

      const disclaimerField = screen
        .getByText("Disclaimers")
        .closest("div")!.parentElement!;
      expect(screen.queryByText("Medical")).not.toBeNull();

      fireEvent.click(
        within(disclaimerField).getByRole("button", { name: /select/i })
      );
      fireEvent.click(screen.getByText("Financial"));
      fireEvent.click(
        within(disclaimerField).getByRole("button", { name: /select/i })
      );
      expect(screen.queryByText("Medical")).not.toBeNull();
      expect(screen.queryByText("Financial")).not.toBeNull();

      fireEvent.click(
        within(disclaimerField).getByRole("button", { name: "Remove Medical" })
      );
      expect(screen.queryByText("Medical")).toBeNull();
      expect(screen.queryByText("Financial")).not.toBeNull();

      fireEvent.click(screen.getByRole("button", { name: "Switch guide" }));
      expect(screen.queryByText("Medical")).toBeNull();
      expect(screen.queryByText("Financial")).toBeNull();

      fireEvent.click(
        within(
          screen.getByText("Disclaimers").closest("div")!.parentElement!
        ).getByRole("button", { name: /select/i })
      );
      fireEvent.click(screen.getByText("Medical"));
      fireEvent.click(
        within(disclaimerField).getByRole("button", { name: /select/i })
      );
      expect(screen.queryByText("Medical")).not.toBeNull();

      fireEvent.click(screen.getByRole("button", { name: "Switch guide" }));
      expect(screen.queryByText("Medical")).toBeNull();
      expect(screen.queryByText("Financial")).not.toBeNull();
    }
  );
});

describe("Guide edit change summary initialization", () => {
  const STALE_NOTICE = "This guide changed while your draft was open";

  const snapshotOf = (
    status: "draft" | "submitted",
    approvedAt: string | null
  ) => ({
    knowledge_type: guide.type,
    base_slug: "binary-search",
    revision: {
      ...guide,
      status,
      change_summary: "Clarify the example",
      created_at: "2026-09-10T00:00:00Z",
      approved_at: approvedAt,
    },
    subjects: [],
    prerequisites: [],
    todos: [],
    disclaimers: [],
  });

  const renderRevision = async (
    status: "draft" | "submitted",
    draftId: string | null,
    // When the live revision went live, relative to the 2026-09-10 draft.
    liveApprovedAt = "2026-09-01T00:00:00Z"
  ) => {
    useLoaderData.mockReturnValue({
      variant: { id: "variant-id", slug: "official" },
      current: { created_at: "2026-09-16T00:00:00Z" },
      live: snapshotOf("submitted", liveApprovedAt),
      snapshot: snapshotOf(status, null),
      draftId,
    });

    const EditGuide = Route.options.component!;
    render(<EditGuide />);
    await act(() => Promise.resolve());

    const changeSummary = screen.getByPlaceholderText("Describe what changed.");
    if (!(changeSummary instanceof HTMLTextAreaElement)) {
      throw new TypeError("Change Summary is not a textarea");
    }

    return changeSummary;
  };

  it("warns when a newer revision went live after the resumed draft was started", async () => {
    await renderRevision("draft", "draft-id", "2026-09-15T00:00:00Z");

    expect(screen.getByText(STALE_NOTICE)).toBeDefined();
  });

  it("stays quiet when the live revision predates the resumed draft", async () => {
    await renderRevision("draft", "draft-id");

    expect(screen.queryByText(STALE_NOTICE)).toBeNull();
  });

  it("stays quiet on a fresh edit, which starts from the live revision", async () => {
    await renderRevision("submitted", null, "2026-09-15T00:00:00Z");

    expect(screen.queryByText(STALE_NOTICE)).toBeNull();
  });

  it("starts a fresh edit of an approved submitted revision with a blank change summary", async () => {
    const changeSummary = await renderRevision("submitted", null);

    expect(changeSummary.value).toBe("");
  });

  it("does not treat a draft query parameter as proof that the snapshot is a draft", async () => {
    const changeSummary = await renderRevision("submitted", "submitted-id");

    expect(changeSummary.value).toBe("");
  });

  it("preserves the saved change summary when resuming a draft", async () => {
    const changeSummary = await renderRevision("draft", "draft-id");

    expect(changeSummary.value).toBe("Clarify the example");
  });
});
