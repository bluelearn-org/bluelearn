// @vitest-environment jsdom
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
} from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { useState } from "react";
import type { ComponentType, ReactNode } from "react";
import type * as XyflowReact from "@xyflow/react";
import type { Walkthrough } from "@bluelearn/schemas";

import type {
  ObjectiveGraphData,
  ObjectiveGraphNode,
} from "@/types/contributions";
import { getGuideWalkthrough } from "@/lib/api/guides";
import {
  ObjectiveDesign,
  upstreamAndDownstream,
} from "@/components/contribute/steps/objective/ObjectiveDesign";

// Render each node through its registered type so jsdom never measures, the
// same reason components/graph/__tests__/GuideGraph.test.tsx mocks xyflow.
vi.mock("@xyflow/react", async () => {
  const actual = await vi.importActual<typeof XyflowReact>("@xyflow/react");
  return {
    ...actual,
    ReactFlowProvider: ({ children }: { children: ReactNode }) => (
      <div>{children}</div>
    ),
    ReactFlow: ({
      nodes,
      nodeTypes,
      onDelete,
      onNodeDragStop,
      onNodeMouseEnter,
      onNodeMouseLeave,
    }: {
      nodes: Array<{
        id: string;
        type: string;
        data: unknown;
        position: { x: number; y: number };
      }>;
      nodeTypes: Record<string, ComponentType<{ data: unknown }>>;
      onDelete: (deleted: {
        nodes: Array<unknown>;
        edges: Array<unknown>;
      }) => void;
      onNodeDragStop: (
        event: unknown,
        node: unknown,
        nodes: Array<unknown>
      ) => void;
      onNodeMouseEnter: (event: unknown, node: { id: string }) => void;
      onNodeMouseLeave: (event: unknown, node: { id: string }) => void;
    }) => (
      <div data-testid="react-flow">
        {nodes.map((node) => {
          const NodeComponent = nodeTypes[node.type];
          const dropped = { ...node, position: { x: 999, y: 999 } };
          return (
            <div
              key={node.id}
              data-testid={`node-${node.id}`}
              data-position={`${node.position.x},${node.position.y}`}
              onMouseEnter={(event) => onNodeMouseEnter(event, node)}
              onMouseLeave={(event) => onNodeMouseLeave(event, node)}
            >
              <NodeComponent data={node.data} />
              <button onClick={() => onDelete({ nodes: [node], edges: [] })}>
                Delete {node.id}
              </button>
              <button onClick={() => onNodeDragStop({}, dropped, [dropped])}>
                Drag {node.id}
              </button>
            </div>
          );
        })}
      </div>
    ),
    Background: () => null,
    Controls: () => null,
    Handle: () => null,
  };
});

vi.mock("@/lib/themeProvider", () => ({
  useTheme: () => ({ theme: "light" }),
}));

const RECURSION_TARGET: ObjectiveGraphNode = {
  id: "picked",
  type: "target",
  guideBaseId: "base-rec",
  guideSlug: "recursion",
  title: "Recursion",
};

vi.mock("@/components/contribute/StepperActionHeader", () => ({
  StepperActionHeader: ({
    onAddGuideNodes,
  }: {
    onAddGuideNodes?: (nodes: Array<ObjectiveGraphNode>) => void;
  }) => (
    <button onClick={() => onAddGuideNodes?.([RECURSION_TARGET])}>
      Add target
    </button>
  ),
}));

vi.mock("@/lib/api/guides", () => ({
  getGuideWalkthrough: vi.fn(),
}));

const walkthroughStep = (id: string, title: string) => ({
  id,
  slug: title.toLowerCase(),
  title,
  summary: null,
  level: 1,
  duration_minutes: 5,
  tags: [],
});

const Stepper = {
  Content: ({ children }: { children: ReactNode }) => <div>{children}</div>,
};

function DesignWithState({
  initial,
  onTargetsChange,
}: {
  initial: ObjectiveGraphData;
  onTargetsChange: (change: {
    added?: Array<string>;
    removed?: Array<string>;
  }) => void;
}) {
  const [graph, setGraph] = useState(initial);

  return (
    <ObjectiveDesign
      Stepper={Stepper}
      type="objective"
      objectiveGraph={graph}
      setObjectiveGraph={setGraph}
      onTargetsChange={onTargetsChange}
    />
  );
}

const EMPTY_HINT = /no guides yet/i;

function renderDesign(graph: ObjectiveGraphData) {
  return render(
    <ObjectiveDesign
      Stepper={Stepper}
      type="objective"
      objectiveGraph={graph}
    />
  );
}

describe("ObjectiveDesign", () => {
  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it("renders guide, target and request cards from the draft graph", () => {
    renderDesign({
      nodes: [
        {
          id: "n1",
          type: "guide",
          guideBaseId: "b1",
          guideSlug: "loops",
          title: "Loops",
        },
        {
          id: "n2",
          type: "target",
          guideBaseId: "b2",
          guideSlug: "recursion",
          title: "Recursion",
        },
        {
          id: "n3",
          type: "guide_request",
          title: "Call stacks",
          summary: "What a frame holds",
        },
      ],
      edges: [{ id: "n1-n2", source: "n1", target: "n2" }],
    });

    expect(screen.getByText("Loops")).toBeTruthy();
    expect(screen.getByText("Recursion")).toBeTruthy();
    expect(screen.getAllByText("Target Guide")).toHaveLength(1);
    expect(screen.getByText("Call stacks")).toBeTruthy();
    expect(screen.getByText("What a frame holds")).toBeTruthy();
    expect(screen.getAllByText(/guide request/i)).toHaveLength(1);
    expect(screen.queryByText(EMPTY_HINT)).toBeNull();
  });

  it("shows the empty hint and no card when the graph is empty", () => {
    const { container } = renderDesign({ nodes: [], edges: [] });

    expect(screen.getByText(EMPTY_HINT)).toBeTruthy();
    expect(screen.queryByTestId("react-flow")).toBeNull();
    expect(container.querySelector('[data-slot="card"]')).toBeNull();
  });

  it("adds a target with its prerequisites and reports its slug up", async () => {
    const walkthrough: Walkthrough = {
      nodes: [
        walkthroughStep("base-loops", "Loops"),
        walkthroughStep("base-rec", "Recursion"),
      ],
      edges: [{ from_id: "base-loops", to_id: "base-rec" }],
    };
    vi.mocked(getGuideWalkthrough).mockResolvedValue(walkthrough);
    const onTargetsChange = vi.fn();

    render(
      <DesignWithState
        initial={{ nodes: [], edges: [] }}
        onTargetsChange={onTargetsChange}
      />
    );
    fireEvent.click(screen.getByRole("button", { name: "Add target" }));

    expect(onTargetsChange).toHaveBeenCalledWith({ added: ["recursion"] });
    expect(getGuideWalkthrough).toHaveBeenCalledWith("recursion");
    expect(await screen.findByText("Loops")).toBeTruthy();
    expect(screen.getAllByText("Recursion")).toHaveLength(1);
    expect(screen.getAllByText("Target Guide")).toHaveLength(1);
  });

  it("leaves no prerequisites behind for a target deleted before its walkthrough arrives", async () => {
    let resolveWalkthrough: (walkthrough: Walkthrough) => void = () => {};
    vi.mocked(getGuideWalkthrough).mockReturnValue(
      new Promise((resolve) => {
        resolveWalkthrough = resolve;
      })
    );

    render(
      <DesignWithState
        initial={{ nodes: [], edges: [] }}
        onTargetsChange={() => {}}
      />
    );
    fireEvent.click(screen.getByRole("button", { name: "Add target" }));
    fireEvent.click(screen.getByRole("button", { name: /^delete /i }));

    await act(async () => {
      resolveWalkthrough({
        nodes: [
          walkthroughStep("base-loops", "Loops"),
          walkthroughStep("base-rec", "Recursion"),
        ],
        edges: [{ from_id: "base-loops", to_id: "base-rec" }],
      });
    });

    expect(screen.queryByText("Loops")).toBeNull();
    expect(screen.getByText(EMPTY_HINT)).toBeTruthy();
  });

  it("reports a deleted target as removed, and a deleted guide not at all", () => {
    const onTargetsChange = vi.fn();

    render(
      <DesignWithState
        initial={{
          nodes: [
            {
              id: "n1",
              type: "guide",
              guideBaseId: "b1",
              guideSlug: "loops",
              title: "Loops",
            },
            {
              id: "n2",
              type: "target",
              guideBaseId: "b2",
              guideSlug: "recursion",
              title: "Recursion",
            },
          ],
          edges: [],
        }}
        onTargetsChange={onTargetsChange}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: "Delete n1" }));
    expect(onTargetsChange).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole("button", { name: "Delete n2" }));
    expect(onTargetsChange).toHaveBeenCalledWith({ removed: ["recursion"] });
    expect(screen.queryByText("Recursion")).toBeNull();
  });

  it("keeps a dragged node where it was dropped when a guide is added", async () => {
    vi.mocked(getGuideWalkthrough).mockResolvedValue({ nodes: [], edges: [] });

    render(
      <DesignWithState
        initial={{
          nodes: [
            {
              id: "n1",
              type: "guide",
              guideBaseId: "b1",
              guideSlug: "loops",
              title: "Loops",
            },
          ],
          edges: [],
        }}
        onTargetsChange={() => {}}
      />
    );
    fireEvent.click(screen.getByRole("button", { name: "Drag n1" }));
    fireEvent.click(screen.getByRole("button", { name: "Add target" }));

    expect(await screen.findByText("Recursion")).toBeTruthy();
    expect(screen.getByTestId("node-n1").dataset.position).toBe("999,999");
  });

  const guide = (id: string) => ({
    id,
    type: "guide" as const,
    guideBaseId: `base-${id}`,
    guideSlug: id,
    title: id.toUpperCase(),
  });
  const isDimmed = (id: string) =>
    screen
      .getByTestId(`node-${id}`)
      .firstElementChild!.classList.contains("opacity-30");

  it("dims only what the hovered node neither needs nor leads to, until the pointer leaves", () => {
    renderDesign({
      nodes: ["a", "b", "c", "d"].map(guide),
      edges: [
        { id: "a-b", source: "a", target: "b" },
        { id: "b-c", source: "b", target: "c" },
      ],
    });

    fireEvent.mouseEnter(screen.getByTestId("node-b"));
    expect(["a", "b", "c", "d"].map(isDimmed)).toEqual([
      false,
      false,
      false,
      true,
    ]);

    fireEvent.mouseLeave(screen.getByTestId("node-b"));
    expect(isDimmed("d")).toBe(false);
  });

  it("dims nothing once the hovered node is deleted", () => {
    render(
      <DesignWithState
        initial={{
          nodes: ["a", "b"].map(guide),
          edges: [{ id: "a-b", source: "a", target: "b" }],
        }}
        onTargetsChange={() => {}}
      />
    );

    fireEvent.mouseEnter(screen.getByTestId("node-b"));
    fireEvent.click(screen.getByRole("button", { name: "Delete b" }));

    expect(isDimmed("a")).toBe(false);
  });
});

describe("upstreamAndDownstream", () => {
  const reach = (sides: ReturnType<typeof upstreamAndDownstream>) =>
    new Set([...sides.upstream, ...sides.downstream]);

  it("reaches everything upstream and downstream, and nothing unconnected", () => {
    const edges = [
      { id: "a-b", source: "a", target: "b" },
      { id: "b-c", source: "b", target: "c" },
    ];

    expect(reach(upstreamAndDownstream(edges, "b"))).toEqual(
      new Set(["a", "c"])
    );
    expect(reach(upstreamAndDownstream(edges, "d"))).toEqual(new Set());
  });

  it("keeps prerequisites upstream and follow-ups downstream", () => {
    const edges = [
      { id: "a-h", source: "a", target: "h" },
      { id: "h-c", source: "h", target: "c" },
    ];

    const { upstream, downstream } = upstreamAndDownstream(edges, "h");
    expect(upstream).toEqual(new Set(["a"]));
    expect(downstream).toEqual(new Set(["c"]));
  });

  it("terminates on a cycle, leaving the hovered node on neither side", () => {
    const edges = [
      { id: "a-b", source: "a", target: "b" },
      { id: "b-a", source: "b", target: "a" },
    ];

    expect(upstreamAndDownstream(edges, "a")).toEqual({
      upstream: new Set(["b"]),
      downstream: new Set(["b"]),
    });
  });
});
