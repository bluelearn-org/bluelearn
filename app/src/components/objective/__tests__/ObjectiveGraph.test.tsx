// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { useMemo, useState } from "react";
import type { ReactNode } from "react";
import type {
  ObjectiveSnapshot,
  ObjectiveSnapshotNode,
  Walkthrough,
} from "@bluelearn/schemas";
import {
  ObjectiveGraph,
  useObjectiveSelection,
} from "@/components/objective/ObjectiveGraph";
import ObjectiveFlow from "@/components/objective/ObjectiveFlow";
import { buildObjectiveFlow } from "@/lib/objectiveSnapshot";
import { WalkthroughPanel } from "@/components/graph/WalkthroughPanel";

// Keep link destinations visible without mounting the application router.
vi.mock("@tanstack/react-router", () => ({
  Link: ({
    children,
    to,
    params,
    search,
  }: {
    children: ReactNode;
    to: string;
    params?: { slug: string };
    search?: Record<string, string | undefined>;
  }) => {
    const path = params ? to.replace("$slug", params.slug) : to;
    const query = new URLSearchParams(
      Object.entries(search ?? {}).filter(
        (entry): entry is [string, string] => entry[1] !== undefined
      )
    ).toString();

    return <a href={query ? `${path}?${query}` : path}>{children}</a>;
  },
}));

vi.mock("@/routes/guides/$slug/index", () => ({
  Route: { to: "/guides/$slug" },
}));

// xyflow needs real layout; one button per node keeps clicks, selection and
// fullscreen reachable in jsdom.
vi.mock("@/components/graph/GuideGraph", () => ({
  GuideGraph: ({
    walkthroughData,
    onNodeClick,
    getNodeState,
    isFullscreen,
    onToggleFullscreen,
  }: {
    walkthroughData: Walkthrough;
    onNodeClick: (id: string) => void;
    getNodeState: (id: string) => { isSelected: boolean };
    isFullscreen: boolean;
    onToggleFullscreen: () => void;
  }) => (
    <div data-testid="graph" data-fullscreen={String(isFullscreen)}>
      {walkthroughData.nodes.map((node) => (
        <button
          key={node.id}
          data-selected={String(getNodeState(node.id).isSelected)}
          onClick={() => onNodeClick(node.id)}
        >
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
const panel = () => screen.queryByRole("complementary");
const highlighted = (name: string) =>
  screen.getByRole("button", { name }).getAttribute("data-selected");

function Graph({
  snapshot: graphSnapshot,
  preview,
}: {
  snapshot: ObjectiveSnapshot;
  preview?: boolean;
}) {
  const selection = useObjectiveSelection(graphSnapshot);

  return (
    <ObjectiveGraph
      objective={objective}
      snapshot={graphSnapshot}
      guides={[]}
      selectedId={selection.selectedId}
      onSelect={selection.select}
      preview={preview}
    />
  );
}

describe("ObjectiveGraph", () => {
  afterEach(() => {
    cleanup();
  });

  it("starts folded into a rail and opens on the target from the rail", () => {
    render(<Graph snapshot={snapshot} />);

    expect(panel()).toBeNull();
    expect(highlighted("Termination proofs")).toBe("true");

    fireEvent.click(screen.getByRole("button", { name: "Open panel" }));
    expect(
      screen.getByRole("heading", { name: "Termination proofs" })
    ).toBeTruthy();
    expect(screen.queryAllByRole("link")).toHaveLength(0);
  });

  it("opens on a node click and folds back on Close panel", () => {
    render(<Graph snapshot={snapshot} />);

    fireEvent.click(screen.getByRole("button", { name: "Loops" }));
    expect(screen.getByRole("heading", { name: "Loops" })).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Open panel" })).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "Close panel" }));
    expect(panel()).toBeNull();
    expect(screen.getByRole("button", { name: "Open panel" })).toBeTruthy();
    expect(highlighted("Termination proofs")).toBe("true");
  });

  it("offers the guide's own page for a guide and takes it away for a request", () => {
    render(<Graph snapshot={snapshot} />);

    fireEvent.click(screen.getByRole("button", { name: "Loops" }));
    expect(openGuide()?.getAttribute("href")).toBe(
      "/guides/loops?objective=proofs"
    );

    fireEvent.click(screen.getByRole("button", { name: "Loop invariants" }));
    expect(
      screen.getByRole("heading", { name: "Loop invariants" })
    ).toBeTruthy();
    expect(screen.getByText("About this request")).toBeTruthy();
    expect(openGuide()).toBeNull();
  });

  it("links nowhere in a preview, even for a guide", () => {
    render(<Graph snapshot={snapshot} preview />);

    fireEvent.click(screen.getByRole("button", { name: "Loops" }));
    expect(screen.getByRole("heading", { name: "Loops" })).toBeTruthy();
    expect(screen.queryAllByRole("link")).toHaveLength(0);
  });

  it("leaves fullscreen on Escape", () => {
    render(<Graph snapshot={snapshot} />);
    const graph = screen.getByTestId("graph");

    fireEvent.click(screen.getByRole("button", { name: "Toggle fullscreen" }));
    expect(graph.getAttribute("data-fullscreen")).toBe("true");

    fireEvent.keyDown(window, { key: "Escape" });
    expect(graph.getAttribute("data-fullscreen")).toBe("false");
  });
});

describe("an objective's graph and linear views", () => {
  afterEach(() => {
    cleanup();
  });

  const twoTargets: ObjectiveSnapshot = {
    nodes: [
      node("basics", {
        guide_base_id: "base-basics",
        slug: "basics",
        title: "Basics",
      }),
      node("tools", {
        guide_base_id: "base-tools",
        slug: "tools",
        title: "Tools",
        is_target: true,
        target_position: 0,
      }),
      node("survey", {
        title: "Soil survey",
        is_target: true,
        is_featured: true,
        target_position: 1,
      }),
    ],
    orders: [{ target_node_id: "tools", node_id: "basics", position: 0 }],
    projected_edges: [],
    raw_edges: [],
    drawn_edges: [{ from_node_id: "basics", to_node_id: "tools" }],
  };

  function Reader({
    initialView = "graph",
    initial,
  }: {
    initialView?: "graph" | "linear";
    initial?: Parameters<typeof useObjectiveSelection>[1];
  }) {
    const [view, setView] = useState<"graph" | "linear">(initialView);
    const selection = useObjectiveSelection(twoTargets, initial);
    const { targets } = useMemo(() => buildObjectiveFlow(twoTargets, []), []);

    return (
      <>
        <button
          onClick={() =>
            setView((current) => (current === "graph" ? "linear" : "graph"))
          }
        >
          Switch view
        </button>

        {view === "graph" ? (
          <ObjectiveGraph
            objective={objective}
            snapshot={twoTargets}
            guides={[]}
            selectedId={selection.selectedId}
            onSelect={selection.select}
          />
        ) : (
          <ObjectiveFlow
            objective={objective}
            targets={targets}
            targetId={selection.targetId}
            onSelectTarget={selection.select}
          />
        )}
      </>
    );
  }

  const switchView = () =>
    fireEvent.click(screen.getByRole("button", { name: "Switch view" }));
  const graphShows = (name: string) =>
    expect(screen.getByRole("heading", { name })).toBeTruthy();
  const linearShows = (name: string) =>
    expect(screen.getByRole("tab", { selected: true }).textContent).toContain(
      name
    );

  it("opens both views on the featured target, not the first", () => {
    render(<Reader />);
    expect(panel()).toBeNull();
    expect(highlighted("Soil survey")).toBe("true");

    switchView();
    linearShows("Soil survey");
  });

  it("keeps the chosen target while a prerequisite is inspected", () => {
    render(<Reader />);

    fireEvent.click(screen.getByRole("button", { name: "Tools" }));
    fireEvent.click(screen.getByRole("button", { name: "Basics" }));
    graphShows("Basics");

    switchView();
    linearShows("Tools");

    switchView();
    graphShows("Basics");

    switchView();
    fireEvent.click(screen.getByRole("tab", { name: /Soil survey/ }));
    linearShows("Soil survey");

    switchView();
    graphShows("Soil survey");
  });

  describe("returning from a guide", () => {
    it("reopens the linear view on the sub-objective it left", () => {
      render(<Reader initialView="linear" initial={{ targetId: "tools" }} />);
      linearShows("Tools");
    });

    it("reopens the graph on the guide it left", () => {
      render(<Reader initial={{ selectedId: "basics" }} />);
      graphShows("Basics");
      expect(highlighted("Basics")).toBe("true");
    });

    it("falls back to the default for a target no longer in the objective", () => {
      render(<Reader initialView="linear" initial={{ targetId: "gone" }} />);
      linearShows("Soil survey");
    });
  });
});

describe("WalkthroughPanel in a guide walkthrough", () => {
  afterEach(() => {
    cleanup();
  });

  const walkthroughNode = (slug: string, title: string) => ({
    id: "00000000-0000-4000-8000-000000000001",
    slug,
    title,
    summary: null,
    level: 0,
    duration_minutes: 5,
    tags: [],
  });
  const backToLoops = () =>
    screen.getByRole("link", { name: "Back to Loops" }).getAttribute("href");

  it("still opens every node it shows and returns to the target guide", () => {
    render(
      <WalkthroughPanel
        node={walkthroughNode("variables", "Variables")}
        targetSlug="loops"
        targetTitle="Loops"
      />
    );

    expect(openGuide()?.getAttribute("href")).toBe("/guides/variables");
    expect(backToLoops()).toBe("/guides/loops");
  });

  describe("reached from a guide inside an objective", () => {
    const objectiveSearch = { objective: "proofs", target: "request-b" };

    it("hands the objective back on return to the target guide", () => {
      render(
        <WalkthroughPanel
          node={walkthroughNode("loops", "Loops")}
          targetSlug="loops"
          targetTitle="Loops"
          objectiveSearch={objectiveSearch}
        />
      );

      expect(backToLoops()).toBe(
        "/guides/loops?objective=proofs&target=request-b"
      );
      expect(openGuide()?.getAttribute("href")).toBe(
        "/guides/loops?objective=proofs&target=request-b"
      );
    });

    it("opens a prerequisite outside the objective's sequence", () => {
      render(
        <WalkthroughPanel
          node={walkthroughNode("variables", "Variables")}
          targetSlug="loops"
          targetTitle="Loops"
          objectiveSearch={objectiveSearch}
        />
      );

      expect(openGuide()?.getAttribute("href")).toBe("/guides/variables");
      expect(backToLoops()).toBe(
        "/guides/loops?objective=proofs&target=request-b"
      );
    });
  });
});
