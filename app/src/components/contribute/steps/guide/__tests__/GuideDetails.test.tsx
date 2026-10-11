// @vitest-environment jsdom
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
} from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { ReactNode } from "react";

import type { GuideContribution } from "@/types/contributions";

import { GuideDetails } from "@/components/contribute/steps/guide/GuideDetails";
import { Route } from "@/routes/guides/$slug/$variantSlug/edit";

const { useLoaderData } = vi.hoisted(() => ({
  useLoaderData: vi.fn(),
}));

vi.mock("@tanstack/react-router", () => ({
  createFileRoute: () => (options: object) => ({ options, useLoaderData }),
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

afterEach(cleanup);

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
});

describe("Guide edit change summary initialization", () => {
  const renderRevision = async (
    status: "draft" | "submitted",
    draftId: string | null
  ) => {
    useLoaderData.mockReturnValue({
      variant: { id: "variant-id", slug: "official" },
      current: { created_at: "2026-09-16T00:00:00Z" },
      snapshot: {
        knowledge_type: guide.type,
        base_slug: "binary-search",
        revision: {
          ...guide,
          status,
          change_summary: "Clarify the example",
        },
        subjects: [],
        prerequisites: [],
        todos: [],
        disclaimers: [],
      },
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
