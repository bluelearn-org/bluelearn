// @vitest-environment jsdom
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { GuideContribution } from "@/types/contributions";
import {
  clearAllStoredDrafts,
  createLocalDraftId,
  getStoredDraftsByType,
  setStoredDraft,
} from "@/lib/contributionStorage";
import ContributionFlow from "@/components/contribute/ContributionFlow";
import { TooltipProvider } from "@/components/ui/tooltip";

const { createGuide, submitRevision, toast } = vi.hoisted(() => ({
  createGuide: vi.fn(),
  submitRevision: vi.fn(),
  toast: { success: vi.fn(), error: vi.fn(), info: vi.fn() },
}));

vi.mock("sonner", () => ({ toast }));

vi.mock("@/lib/api/guides", () => ({
  createGuide: (...args: Array<unknown>) => createGuide(...args),
  listGuides: () => Promise.resolve([]),
  addGuideVariant: vi.fn(),
}));

vi.mock("@/lib/api/guideRevisions", () => ({
  submitRevision: (...args: Array<unknown>) => submitRevision(...args),
  updateRevision: vi.fn(),
  getRevision: vi.fn(),
}));

vi.mock("@/lib/api/subjects", () => ({
  listSubjects: () => Promise.resolve([]),
}));

vi.mock("@/lib/api/identity", () => ({
  getMyIdentity: () => Promise.resolve({ profile: { username: "seeduser" } }),
}));

vi.mock("@/lib/api/media", () => ({ uploadMedia: vi.fn() }));
vi.mock("@/lib/api/objectives", () => ({
  createObjective: vi.fn(),
  createObjectiveRevision: vi.fn(),
}));
vi.mock("@/lib/api/objectiveRevisions", () => ({
  getObjectiveRevision: vi.fn(),
  submitObjectiveRevision: vi.fn(),
  updateObjectiveRevision: vi.fn(),
}));
vi.mock("@/lib/supabase", () => ({ supabase: {} }));

vi.mock("@/components/contribute/steps/guide/GuideInfo", () => ({
  GuideInfo: () => null,
}));
vi.mock("@/components/GuideReader", () => ({
  GuideReader: () => null,
}));

const INCOMPLETE_DRAFT_MESSAGE =
  "Add a title, summary, body, and at least one tag before submitting";

const blankGuide = (): GuideContribution => ({
  type: "theoretical",
  title: "",
  summary: "",
  body: "",
  subjects: [],
  newSubjects: [],
  prereqs: [],
  requests: [],
  disclaimers: [],
});

const completeGuide = (title: string): GuideContribution => ({
  ...blankGuide(),
  title,
  summary: `Summary for ${title}.`,
  body: `Body for ${title}.`,
  subjects: ["10000000-0000-4000-8000-000000000003"],
});

const storeGuides = (guides: Array<GuideContribution>) => {
  guides.forEach((data, index) => {
    setStoredDraft({
      localDraftId: createLocalDraftId(),
      type: "guide",
      data,
      revisionId: null,
      step: "preview-guide",
      // getStoredDraftsByType sorts newest first; the offset keeps the given order
      updatedAt: Date.now() - index * 1000,
    });
  });
};

const renderPreview = () => {
  const onPublished = vi.fn();

  render(
    <TooltipProvider>
      <ContributionFlow
        type="guide"
        setType={() => {}}
        step="preview-guide"
        onPublished={onPublished}
        todoIds={[]}
      />
    </TooltipProvider>
  );

  return { onPublished };
};

const submitAll = async () => {
  fireEvent.click(screen.getAllByRole("button", { name: /^submit\b/i })[0]);

  const dialog = await screen.findByRole("dialog");
  fireEvent.click(within(dialog).getByRole("checkbox"));
  fireEvent.click(within(dialog).getByRole("button", { name: /^submit\b/i }));
};

describe("ContributionFlow batch submit", () => {
  beforeEach(() => {
    clearAllStoredDrafts();
    vi.clearAllMocks();

    createGuide.mockImplementation(({ title }: { title: string | null }) =>
      Promise.resolve(title ? `rev-${title}` : "rev-blank")
    );
    submitRevision.mockImplementation((id: string) =>
      id === "rev-blank"
        ? Promise.reject(new Error(INCOMPLETE_DRAFT_MESSAGE))
        : Promise.resolve()
    );
  });

  afterEach(() => {
    cleanup();
  });

  it("names the batch size on the submit button and in the dialog", async () => {
    storeGuides([
      completeGuide("Batch label guide A"),
      completeGuide("Batch label guide B"),
    ]);
    renderPreview();

    // desktop header and mobile bar both render a submit button
    const buttons = screen.getAllByRole("button", { name: /All/i });
    expect(buttons).toHaveLength(2);
    fireEvent.click(buttons[0]);

    const dialog = await screen.findByRole("dialog");
    expect(within(dialog).getByRole("heading", { name: /All/i })).toBeTruthy();
    expect(within(dialog).getByRole("button", { name: /All/i })).toBeTruthy();
  });

  it("keeps the single-guide wording when one guide is in the workspace", async () => {
    storeGuides([completeGuide("Single label guide")]);
    renderPreview();

    fireEvent.click(
      screen.getAllByRole("button", { name: /^submit for review$/i })[0]
    );

    const dialog = await screen.findByRole("dialog");
    expect(
      within(dialog).getByRole("heading", { name: /submit/i }).textContent
    ).not.toMatch(/\d/);
    expect(
      within(dialog).getByRole("button", { name: /^submit$/i })
    ).toBeTruthy();
  });

  it("keeps a refused guide as a draft and sends the rest", async () => {
    storeGuides([completeGuide("Batch proof guide A"), blankGuide()]);
    const { onPublished } = renderPreview();

    await submitAll();

    await waitFor(() => expect(submitRevision).toHaveBeenCalledTimes(2));

    expect(toast.success).toHaveBeenCalledWith(
      "Submitted for review: Batch proof guide A"
    );
    expect(toast.error).toHaveBeenCalledWith(
      "Could not submit: Untitled guide",
      {
        description: INCOMPLETE_DRAFT_MESSAGE,
      }
    );

    fireEvent.click(
      within(screen.getByRole("dialog")).getByRole("button", { name: "Close" })
    );
    await waitFor(() =>
      expect(
        screen.queryByRole("button", { name: /Batch proof guide A/ })
      ).toBeNull()
    );
    expect(screen.getByRole("button", { name: /Guide 1/ })).toBeTruthy();
    expect(getStoredDraftsByType("guide")).toHaveLength(1);
    expect(onPublished).not.toHaveBeenCalled();
  });

  it("sends every guide and resets when all of them go through", async () => {
    storeGuides([
      completeGuide("Batch proof guide B1"),
      completeGuide("Batch proof guide B2"),
    ]);
    const { onPublished } = renderPreview();

    await submitAll();

    await waitFor(() => expect(onPublished).toHaveBeenCalledTimes(1));

    expect(submitRevision).toHaveBeenCalledTimes(2);
    expect(toast.success).toHaveBeenCalledWith(
      "Submitted for review: Batch proof guide B1"
    );
    expect(toast.success).toHaveBeenCalledWith(
      "Submitted for review: Batch proof guide B2"
    );
    expect(toast.error).not.toHaveBeenCalled();
    expect(getStoredDraftsByType("guide")).toHaveLength(0);
  });
});
