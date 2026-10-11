// @vitest-environment jsdom
import { cleanup, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { ReactNode } from "react";
import type { GuideListItem } from "@bluelearn/schemas";
import { PreviewObjective } from "@/components/contribute/steps/objective/PreviewObjective";
import { objectiveContributionSchema } from "@/types/contributions";

vi.mock("@/components/contribute/StepperActionHeader", () => ({
  StepperActionHeader: () => null,
}));
// The card is the boundary here; graph interactions have their own coverage.
vi.mock("@/components/objective/ObjectiveGraph", () => ({
  ObjectiveGraph: () => null,
}));

afterEach(cleanup);

const guides: Array<GuideListItem> = [
  ["foundation", "Foundation", 2],
  ["trellis", "Build a Trellis", 3],
  ["water", "Manage Water", 4],
  ["hidden", "Hidden prerequisite", 20],
].map(([slug, title, duration]) => ({
  id: String(slug),
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

function renderPreview(sequences: Array<Array<string>>, requestTarget = false) {
  const objective = objectiveContributionSchema.parse({
    title: "Homestead",
    summary: "Learn to build a homestead.",
    changeSummary: "",
    subjects: [],
    newSubjects: [],
    targets: ["trellis", "water"],
    featuredSubObjective: "trellis",
    subObjectives: ["trellis", "water"].map((targetNodeId, index) => ({
      targetNodeId,
      selectedNodeIds: sequences[index],
      curatedSequence: sequences[index],
    })),
    graph: {
      nodes: guides.map((guide) =>
        requestTarget && guide.slug === "trellis"
          ? {
              id: guide.slug,
              type: "guide_request",
              title: "Requested trellis",
              summary: "This guide still needs to be written.",
            }
          : {
              id: guide.slug,
              type: "guide",
              guideBaseId: guide.id,
              guideSlug: guide.slug,
              title: guide.title,
            }
      ),
      edges: [],
    },
  });

  render(
    <PreviewObjective
      Stepper={{ Content: ({ children }: { children: ReactNode }) => children }}
      objectiveContData={objective}
      setObjectiveContData={vi.fn()}
      onPublish={vi.fn()}
      submitting={false}
      guideOptions={guides}
      subjectOptions={[]}
    />
  );

  return within(screen.getByText("Homestead").closest('[data-slot="card"]')!);
}

describe("objective preview card", () => {
  it("ends the featured sequence at its target and counts shared guides once", () => {
    const card = renderPreview([["foundation"], ["foundation"]]);

    expect(card.getByText("Foundation")).toBeTruthy();
    expect(card.getByText("Build a Trellis")).toBeTruthy();
    expect(card.queryByText("Hidden prerequisite")).toBeNull();

    expect(card.getByText("9 min")).toBeTruthy();
    expect(card.getByText("Guides").parentElement?.textContent).toContain("3");
  });

  it("keeps target-only sequences when every prerequisite is hidden", () => {
    const card = renderPreview([[], []]);

    expect(card.getByText("Build a Trellis")).toBeTruthy();
    expect(card.queryByText("Foundation")).toBeNull();

    expect(card.getByText("7 min")).toBeTruthy();
    expect(card.getByText("Guides").parentElement?.textContent).toContain("2");
  });

  it("uses the request title without borrowing an existing guide's duration", () => {
    const card = renderPreview([["foundation"], ["foundation"]], true);

    expect(card.getByText("Requested trellis")).toBeTruthy();
    expect(card.queryByText("Build a Trellis")).toBeNull();

    expect(card.getByText("6 min")).toBeTruthy();
    expect(card.getByText("Guides").parentElement?.textContent).toContain("3");
  });
});
