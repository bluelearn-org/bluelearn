// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { ReactNode } from "react";
import type {
  ObjectiveSnapshot,
  ObjectiveSnapshotNode,
  Walkthrough,
} from "@bluelearn/schemas";
import { ObjectiveGraph } from "@/components/objective/ObjectiveGraph";
import { WalkthroughPanel } from "@/components/graph/WalkthroughPanel";

// Keep link destinations visible without mounting the application router.
vi.mock("@tanstack/react-router", () => ({
  Link: ({
    children,
    to,
    params,
  }: {
    children: ReactNode;
    to: string;
    params?: { slug: string };
  }) => <a href={params ? to.replace("$slug", params.slug) : to}>{children}</a>,
}));

// xyflow needs real layout; one button per node keeps clicks and fullscreen
// reachable in jsdom.
vi.mock("@/components/graph/GuideGraph", () => ({
  GuideGraph: ({
    walkthroughData,
    onNodeClick,
    isFullscreen,
    onToggleFullscreen,
  }: {
    walkthroughData: Walkthrough;
    onNodeClick: (id: string) => void;
    isFullscreen: boolean;
    onToggleFullscreen: () => void;
  }) => (
    <div data-testid="graph" data-fullscreen={String(isFullscreen)}>
      {walkthroughData.nodes.map((node) => (
        <button key={node.id} onClick={() => onNodeClick(node.id)}>
          {node.title}
        </button>
      ))}
      <button onClick={onToggleFullscreen}>Toggle fullscreen</button>
    </div>
  ),
}));

const node = (
  id: string,
  fields: Partial<ObjectiveSnapshotNode>
): ObjectiveSnapshotNode => ({
  id,
  guide_base_id: null,
  guide_id: null,
  slug: null,
  title: null,
  summary: null,
  request_id: null,
  is_target: false,
  is_included: true,
  is_featured: false,
  target_position: null,
  note: null,
  ...fields,
});

const snapshot: ObjectiveSnapshot = {
  nodes: [
    node("guide", {
      guide_base_id: "base-guide",
      slug: "loops",
      title: "Loops",
    }),
    node("request-a", { title: "Loop invariants", summary: "Reasoning" }),
    node("request-b", { title: "Termination proofs", is_target: true }),
  ],
  orders: [],
  projected_edges: [],
  raw_edges: [],
  drawn_edges: [
    { from_node_id: "guide", to_node_id: "request-a" },
    { from_node_id: "request-a", to_node_id: "request-b" },
  ],
};

const objective = { slug: "proofs", title: "Proofs" };

const openGuide = () => screen.queryByRole("link", { name: "Open Guide" });

describe("ObjectiveGraph", () => {
  afterEach(() => {
    cleanup();
  });

  it("opens on the target request with no link anywhere in the panel", () => {
    render(
      <ObjectiveGraph objective={objective} snapshot={snapshot} guides={[]} />
    );

    expect(
      screen.getByRole("heading", { name: "Termination proofs" })
    ).toBeTruthy();
    expect(screen.queryAllByRole("link")).toHaveLength(0);
  });

  it("offers the guide's own page for a guide and takes it away for a request", () => {
    render(
      <ObjectiveGraph objective={objective} snapshot={snapshot} guides={[]} />
    );

    fireEvent.click(screen.getByRole("button", { name: "Loops" }));
    expect(openGuide()?.getAttribute("href")).toBe("/guides/loops");

    fireEvent.click(screen.getByRole("button", { name: "Loop invariants" }));
    expect(
      screen.getByRole("heading", { name: "Loop invariants" })
    ).toBeTruthy();
    expect(screen.getByText("About this request")).toBeTruthy();
    expect(openGuide()).toBeNull();
  });

  it("links nowhere in a preview, even for a guide", () => {
    render(
      <ObjectiveGraph
        objective={objective}
        snapshot={snapshot}
        guides={[]}
        preview
      />
    );

    fireEvent.click(screen.getByRole("button", { name: "Loops" }));
    expect(screen.getByRole("heading", { name: "Loops" })).toBeTruthy();
    expect(screen.queryAllByRole("link")).toHaveLength(0);
  });

  it("leaves fullscreen on Escape", () => {
    render(
      <ObjectiveGraph objective={objective} snapshot={snapshot} guides={[]} />
    );
    const graph = screen.getByTestId("graph");

    fireEvent.click(screen.getByRole("button", { name: "Toggle fullscreen" }));
    expect(graph.getAttribute("data-fullscreen")).toBe("true");

    fireEvent.keyDown(window, { key: "Escape" });
    expect(graph.getAttribute("data-fullscreen")).toBe("false");
  });
});

describe("WalkthroughPanel in a guide walkthrough", () => {
  afterEach(() => {
    cleanup();
  });

  it("still opens every node it shows and returns to the target guide", () => {
    render(
      <WalkthroughPanel
        node={{
          id: "00000000-0000-4000-8000-000000000001",
          slug: "variables",
          title: "Variables",
          summary: null,
          level: 0,
          duration_minutes: 5,
          tags: [],
        }}
        targetSlug="loops"
        targetTitle="Loops"
      />
    );

    expect(openGuide()?.getAttribute("href")).toBe("/guides/variables");
    expect(
      screen.getByRole("link", { name: "Back to Loops" }).getAttribute("href")
    ).toBe("/guides/loops");
  });
});
