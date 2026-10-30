// @vitest-environment jsdom
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ObjectiveSnapshot, Walkthrough } from "@bluelearn/schemas";
import { clearAllStoredDrafts } from "@/lib/contributionStorage";
import ContributionFlow from "@/components/contribute/ContributionFlow";
import { TooltipProvider } from "@/components/ui/tooltip";

const { getObjectiveRevision, updateObjectiveRevision, getGuideWalkthrough } =
  vi.hoisted(() => ({
    getObjectiveRevision: vi.fn(),
    updateObjectiveRevision: vi.fn(),
    getGuideWalkthrough: vi.fn(),
  }));

vi.mock("sonner", () => ({
  toast: { success: vi.fn(), error: vi.fn(), info: vi.fn() },
}));

vi.mock("@/lib/api/guides", () => ({
  createGuide: vi.fn(),
  addGuideVariant: vi.fn(),
  listGuides: () => Promise.resolve(guides),
  getGuideWalkthrough: (...args: Array<unknown>) =>
    getGuideWalkthrough(...args),
}));
vi.mock("@/lib/api/guideRevisions", () => ({
  submitRevision: vi.fn(),
  updateRevision: vi.fn(),
  getRevision: vi.fn(),
}));
vi.mock("@/lib/api/subjects", () => ({
  listSubjects: () => Promise.resolve([]),
}));
vi.mock("@/lib/api/identity", () => ({
  getMyIdentity: () => Promise.resolve({ profile: { username: "curator" } }),
}));
vi.mock("@/lib/api/media", () => ({ uploadMedia: vi.fn() }));
vi.mock("@/lib/api/objectives", () => ({
  createObjective: vi.fn(),
  createObjectiveRevision: vi.fn(),
}));
vi.mock("@/lib/api/objectiveRevisions", () => ({
  getObjectiveRevision: (...args: Array<unknown>) =>
    getObjectiveRevision(...args),
  updateObjectiveRevision: (...args: Array<unknown>) =>
    updateObjectiveRevision(...args),
  submitObjectiveRevision: vi.fn(),
}));
vi.mock("@/lib/supabase", () => ({ supabase: {} }));

vi.mock("@/components/contribute/steps/guide/GuideInfo", () => ({
  GuideInfo: () => null,
}));
vi.mock("@/components/GuideReader", () => ({
  GuideReader: () => null,
}));
// The preview card's totals read the same inclusion the graph draws.
vi.mock("@/components/objective/ObjectiveGraph", async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  ObjectiveGraph: () => null,
}));

const REVISION_ID = "30000000-0000-4000-8000-000000000001";
const SYSTEMS = "10000000-0000-4000-8000-000000000001";
const TOOLS = "10000000-0000-4000-8000-000000000002";
const SYSTEMS_BASE = "20000000-0000-4000-8000-000000000001";
const TOOLS_BASE = "20000000-0000-4000-8000-000000000002";

const guides = [
  [SYSTEMS_BASE, "systems", "Systems", 2],
  [TOOLS_BASE, "tools", "Tools", 3],
].map(([id, slug, title, duration]) => ({
  id: String(id),
  slug: String(slug),
  title: String(title),
  duration_minutes: Number(duration),
  summary: null,
  knowledge_type: "practical",
  status: "published",
  created_at: "2026-01-01T00:00:00Z",
  author: null,
  tags: [],
  is_official: false,
}));

const walkthrough: Walkthrough = {
  nodes: guides.map((guide, level) => ({
    id: guide.id,
    slug: guide.slug,
    title: guide.title,
    summary: null,
    level,
    duration_minutes: guide.duration_minutes,
    tags: [],
  })),
  edges: [{ from_id: SYSTEMS_BASE, to_id: TOOLS_BASE }],
};

function revision(systemsIncluded: boolean) {
  const node = (id: string, baseId: string, slug: string, title: string) => ({
    id,
    guide_base_id: baseId,
    guide_id: null,
    slug,
    title,
    summary: null,
    request_id: null,
    note: null,
  });
  const snapshot: ObjectiveSnapshot = {
    nodes: [
      {
        ...node(SYSTEMS, SYSTEMS_BASE, "systems", "Systems"),
        is_target: false,
        is_included: systemsIncluded,
        is_featured: false,
        target_position: null,
      },
      {
        ...node(TOOLS, TOOLS_BASE, "tools", "Tools"),
        is_target: true,
        is_included: true,
        is_featured: true,
        target_position: 0,
      },
    ],
    orders: [],
    projected_edges: [],
    raw_edges: [{ from_id: SYSTEMS_BASE, to_id: TOOLS_BASE }],
    drawn_edges: [],
  };

  return {
    revision: {
      id: REVISION_ID,
      title: "Workshop",
      summary: "Learn the workshop.",
      change_summary: null,
      status: "draft",
      created_at: "2026-01-01T00:00:00Z",
      published_at: null,
      updated_at: "2026-01-01T00:00:00Z",
    },
    objective: {
      id: "40000000-0000-4000-8000-000000000001",
      current_revision_id: null,
    },
    snapshot,
    subjects: [],
  };
}

function reopen(saved: ReturnType<typeof revision>) {
  getObjectiveRevision.mockResolvedValue(saved);
  updateObjectiveRevision.mockResolvedValue(saved);

  render(
    <TooltipProvider>
      <ContributionFlow
        type="objective"
        setType={() => {}}
        step="preview-objective"
        draftId={REVISION_ID}
        draftKind="objective"
        todoIds={[]}
      />
    </TooltipProvider>
  );
}

const previewCard = () =>
  within(screen.getByText("Workshop").closest('[data-slot="card"]')!);

async function savedTargets() {
  updateObjectiveRevision.mockClear();
  fireEvent.click(screen.getAllByRole("button", { name: /save drafts?/i })[0]);
  await waitFor(() => expect(updateObjectiveRevision).toHaveBeenCalled());

  return updateObjectiveRevision.mock.lastCall?.[1].targets;
}

describe("reopening an objective revision", () => {
  beforeEach(() => {
    clearAllStoredDrafts();
    vi.clearAllMocks();
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it("keeps an emptied target empty in the preview while its walkthrough never arrives", async () => {
    getGuideWalkthrough.mockReturnValue(new Promise(() => {}));
    reopen(revision(false));

    await screen.findByText("Workshop");
    await waitFor(() => expect(previewCard().getByText("3 min")).toBeTruthy());
    expect(
      previewCard().getByText("Guides").parentElement?.textContent
    ).toContain("1");
    expect(previewCard().getByText("Tools")).toBeTruthy();
    expect(previewCard().queryByText("Systems")).toBeNull();

    expect(await savedTargets()).toEqual([
      { node_id: TOOLS, is_featured: true, sequence: [] },
    ]);
  });

  it("does not seed the walkthrough back into an emptied target", async () => {
    const loaded = Promise.resolve(walkthrough);
    getGuideWalkthrough.mockReturnValue(loaded);
    reopen(revision(false));

    await screen.findByText("Workshop");
    await waitFor(() => expect(getGuideWalkthrough).toHaveBeenCalled());
    await act(() => loaded);
    await waitFor(() => expect(previewCard().getByText("3 min")).toBeTruthy());
    expect(previewCard().queryByText("Systems")).toBeNull();

    expect(await savedTargets()).toEqual([
      { node_id: TOOLS, is_featured: true, sequence: [] },
    ]);
  });

  it("still seeds a target that was never curated", async () => {
    const loaded = Promise.resolve(walkthrough);
    getGuideWalkthrough.mockReturnValue(loaded);
    reopen(revision(true));

    await screen.findByText("Workshop");
    await waitFor(() => expect(getGuideWalkthrough).toHaveBeenCalled());
    await act(() => loaded);
    await waitFor(() =>
      expect(previewCard().getByText("Systems")).toBeTruthy()
    );
    expect(previewCard().getByText("5 min")).toBeTruthy();

    expect(await savedTargets()).toEqual([
      { node_id: TOOLS, is_featured: true, sequence: [SYSTEMS] },
    ]);
  });

  it("seeds a never-curated target from the canvas when its walkthrough fails", async () => {
    const offline = new Error("walkthrough offline");
    const consoleError = vi
      .spyOn(console, "error")
      .mockImplementation(() => {});
    getGuideWalkthrough.mockRejectedValue(offline);
    reopen(revision(true));

    await screen.findByText("Workshop");
    await waitFor(() => expect(consoleError).toHaveBeenCalledWith(offline));
    await waitFor(() =>
      expect(previewCard().getByText("Systems")).toBeTruthy()
    );
    expect(previewCard().getByText("5 min")).toBeTruthy();
    expect(
      previewCard().getByText("Guides").parentElement?.textContent
    ).toContain("2");

    expect(await savedTargets()).toEqual([
      { node_id: TOOLS, is_featured: true, sequence: [SYSTEMS] },
    ]);
  });
});
