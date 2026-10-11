// @vitest-environment jsdom
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { useState } from "react";
import { toast } from "sonner";
import type { ComponentType, ReactNode } from "react";
import type * as XyflowReact from "@xyflow/react";
import type { Walkthrough } from "@bluelearn/schemas";

import type {
  ObjectiveGraphData,
  ObjectiveGraphNode,
} from "@/types/contributions";
import { getGuideWalkthrough } from "@/lib/api/guides";
import { drawnEdgeId } from "@/lib/objectiveGraphEdits";
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
      edges,
      nodeTypes,
      onDelete,
      onConnectEnd,
      onConnect,
      onNodesChange,
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
      edges: Array<{ source: string; target: string }>;
      nodeTypes: Record<string, ComponentType<{ data: unknown }>>;
      onDelete: (deleted: {
        nodes: Array<unknown>;
        edges: Array<unknown>;
      }) => void;
      onConnectEnd: (
        event: { clientX: number; clientY: number },
        state: {
          isValid: boolean;
          fromNode: { id: string };
          fromHandle: { type: "source" | "target" };
        }
      ) => void;
      onConnect: (connection: {
        source: string;
        target: string;
        sourceHandle: null;
        targetHandle: null;
      }) => void;
      onNodesChange: (changes: Array<unknown>) => void;
      onNodeDragStop: (
        event: unknown,
        node: unknown,
        nodes: Array<unknown>
      ) => void;
      onNodeMouseEnter: (event: unknown, node: { id: string }) => void;
      onNodeMouseLeave: (event: unknown, node: { id: string }) => void;
    }) => (
      <div
        data-testid="react-flow"
        data-edges={edges.map((e) => `${e.source}>${e.target}`).join(" ")}
      >
        {nodes.map((node) => {
          const NodeComponent = nodeTypes[node.type];
          const dropped = { ...node, position: { x: 999, y: 999 } };
          const moveBy = (dx: number, dy: number) =>
            onNodesChange([
              {
                id: node.id,
                type: "position",
                dragging: true,
                position: {
                  x: node.position.x + dx,
                  y: node.position.y + dy,
                },
              },
            ]);
          return (
            <div
              key={node.id}
              className="react-flow__node"
              data-id={node.id}
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
              <button onClick={() => moveBy(40, -400)}>
                Pull {node.id} across
              </button>
              <button onClick={() => moveBy(40, 10)}>
                Nudge {node.id} along
              </button>
              {(["top", "bottom"] as const).map((dot) => {
                const fromHandle = {
                  type:
                    dot === "top" ? ("source" as const) : ("target" as const),
                };
                const endConnect = (isValid: boolean) =>
                  onConnectEnd(
                    { clientX: 10, clientY: 10 },
                    { isValid, fromNode: node, fromHandle }
                  );

                return (
                  <span key={dot}>
                    {nodes
                      .filter((other) => other.id !== node.id)
                      .map((other) => (
                        <button
                          key={other.id}
                          onClick={() => {
                            // xyflow's loose-mode Connection names the start
                            // node the target when it left a target dot.
                            onConnect({
                              source: dot === "top" ? node.id : other.id,
                              target: dot === "top" ? other.id : node.id,
                              sourceHandle: null,
                              targetHandle: null,
                            });
                            endConnect(true);
                          }}
                        >
                          From {node.id} {dot} dot to {other.id} dot
                        </button>
                      ))}
                    <button onClick={() => endConnect(false)}>
                      From {node.id} {dot} dot to the pointer
                    </button>
                  </span>
                );
              })}
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

vi.mock("sonner", () => ({
  toast: { warning: vi.fn(), error: vi.fn() },
}));

const RECURSION: ObjectiveGraphNode = {
  id: "picked",
  type: "guide",
  guideBaseId: "base-rec",
  guideSlug: "recursion",
  title: "Recursion",
};

vi.mock("@/components/contribute/StepperActionHeader", () => ({
  StepperActionHeader: ({
    onAddGuideNodes,
    onSaveDraft,
  }: {
    onAddGuideNodes?: (
      nodes: Array<ObjectiveGraphNode>,
      options?: { pullPrerequisitesFor: Array<string> }
    ) => void;
    onSaveDraft?: () => void;
  }) => (
    <>
      <button
        onClick={() =>
          onAddGuideNodes?.([RECURSION], {
            pullPrerequisitesFor: ["base-rec"],
          })
        }
      >
        Add with prerequisites
      </button>
      {onSaveDraft && <button onClick={onSaveDraft}>Save Draft</button>}
    </>
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

function DesignWithState({ initial }: { initial: ObjectiveGraphData }) {
  const [graph, setGraph] = useState(initial);

  return (
    <ObjectiveDesign
      Stepper={Stepper}
      type="objective"
      objectiveGraph={graph}
      setObjectiveGraph={setGraph}
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

const LOOPS: ObjectiveGraphNode = {
  id: "n1",
  type: "guide",
  guideBaseId: "b1",
  guideSlug: "loops",
  title: "Loops",
};

// Added nodes get fresh ids, so cards are found by title.
function positionOf(title: string) {
  const card = screen.getByText(title).closest<HTMLElement>("[data-position]")!;
  const [x, y] = card.dataset.position!.split(",").map(Number);
  return { x, y };
}

describe("ObjectiveDesign", () => {
  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it("derives target cards from the draft graph, requests included", () => {
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
          type: "guide",
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
    expect(screen.getByText("Guide")).toBeTruthy();
    expect(screen.getByText("Recursion")).toBeTruthy();
    expect(screen.getAllByText("Target guide")).toHaveLength(1);
    expect(screen.getByText("Call stacks")).toBeTruthy();
    expect(screen.getByText("What a frame holds")).toBeTruthy();
    expect(screen.getAllByText("Target request")).toHaveLength(1);
    expect(screen.queryByText(EMPTY_HINT)).toBeNull();
  });

  it("hands the header onSaveDraft so Save Draft saves the draft", () => {
    const onSaveDraft = vi.fn();
    render(
      <ObjectiveDesign
        Stepper={Stepper}
        type="objective"
        objectiveGraph={{ nodes: [], edges: [] }}
        onSaveDraft={onSaveDraft}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: "Save Draft" }));

    expect(onSaveDraft).toHaveBeenCalledTimes(1);
  });

  it("shows the empty hint and no card when the graph is empty", () => {
    const { container } = renderDesign({ nodes: [], edges: [] });

    expect(screen.getByText(EMPTY_HINT)).toBeTruthy();
    expect(screen.queryByTestId("react-flow")).toBeNull();
    expect(container.querySelector('[data-slot="card"]')).toBeNull();
  });

  it("adds a guide with its prerequisites, and only the guide stays a target", async () => {
    const walkthrough: Walkthrough = {
      nodes: [
        walkthroughStep("base-loops", "Loops"),
        walkthroughStep("base-rec", "Recursion"),
      ],
      edges: [{ from_id: "base-loops", to_id: "base-rec" }],
    };
    vi.mocked(getGuideWalkthrough).mockResolvedValue(walkthrough);

    render(<DesignWithState initial={{ nodes: [], edges: [] }} />);
    fireEvent.click(
      screen.getByRole("button", { name: "Add with prerequisites" })
    );

    expect(getGuideWalkthrough).toHaveBeenCalledWith("recursion");
    expect(await screen.findByText("Loops")).toBeTruthy();
    expect(screen.getAllByText("Recursion")).toHaveLength(1);
    expect(screen.getAllByText("Target guide")).toHaveLength(1);
    expect(positionOf("Loops").y).toBeGreaterThan(positionOf("Recursion").y);
  });

  it("leaves no prerequisites behind for a target deleted before its walkthrough arrives", async () => {
    let resolveWalkthrough: (walkthrough: Walkthrough) => void = () => {};
    vi.mocked(getGuideWalkthrough).mockReturnValue(
      new Promise((resolve) => {
        resolveWalkthrough = resolve;
      })
    );

    render(<DesignWithState initial={{ nodes: [], edges: [] }} />);
    fireEvent.click(
      screen.getByRole("button", { name: "Add with prerequisites" })
    );
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

  it("returns a dropped node to its layout slot, below a guide added later that needs it", async () => {
    vi.mocked(getGuideWalkthrough).mockResolvedValue({
      nodes: [
        walkthroughStep("b1", "Loops"),
        walkthroughStep("base-rec", "Recursion"),
      ],
      edges: [{ from_id: "b1", to_id: "base-rec" }],
    });

    render(<DesignWithState initial={{ nodes: [LOOPS], edges: [] }} />);
    const slot = positionOf("Loops");

    fireEvent.click(screen.getByRole("button", { name: "Drag n1" }));
    expect(positionOf("Loops")).toEqual(slot);

    fireEvent.click(
      screen.getByRole("button", { name: "Add with prerequisites" })
    );
    expect(await screen.findByText("Recursion")).toBeTruthy();
    await waitFor(() =>
      expect(positionOf("Loops").y).toBeGreaterThan(positionOf("Recursion").y)
    );

    expect(positionOf("Loops")).not.toEqual({ x: 999, y: 999 });
    expect(positionOf("Loops").y).toBeGreaterThan(positionOf("Recursion").y);
  });

  it("holds a node pulled toward another row inside its own, and returns it on release", () => {
    render(<DesignWithState initial={{ nodes: [LOOPS], edges: [] }} />);
    const slot = positionOf("Loops");

    fireEvent.click(screen.getByRole("button", { name: "Pull n1 across" }));
    const pulled = positionOf("Loops");
    expect(pulled.x).toBe(slot.x + 40);
    expect(Math.abs(pulled.y - slot.y)).toBeLessThan(100);

    fireEvent.click(screen.getByRole("button", { name: "Drag n1" }));
    expect(positionOf("Loops")).toEqual(slot);
  });

  it("follows a nudge inside the row while dragging, and returns it on release", () => {
    render(<DesignWithState initial={{ nodes: [LOOPS], edges: [] }} />);
    const slot = positionOf("Loops");

    fireEvent.click(screen.getByRole("button", { name: "Nudge n1 along" }));
    expect(positionOf("Loops")).toEqual({ x: slot.x + 40, y: slot.y + 10 });

    fireEvent.click(screen.getByRole("button", { name: "Drag n1" }));
    expect(positionOf("Loops")).toEqual(slot);
  });

  const RECURSION_GUIDE: ObjectiveGraphNode = {
    id: "n2",
    type: "guide",
    guideBaseId: "b2",
    guideSlug: "recursion",
    title: "Recursion",
  };
  const LOOPS_AND_RECURSION: ObjectiveGraphData = {
    nodes: [LOOPS, RECURSION_GUIDE],
    edges: [],
  };

  const edgesDrawn = () => screen.getByTestId("react-flow").dataset.edges;

  // jsdom has no layout, so the test says what lies under the pointer.
  const pointAt = (element: Element | null) => {
    document.elementFromPoint = () => element;
  };

  it.each([
    ["top", "n1>n2"],
    ["bottom", "n2>n1"],
  ])("reads a drag from A's %s dot to B's dot as %s", (dot, edge) => {
    render(<DesignWithState initial={LOOPS_AND_RECURSION} />);

    fireEvent.click(
      screen.getByRole("button", { name: `From n1 ${dot} dot to n2 dot` })
    );

    expect(edgesDrawn()).toBe(edge);
  });

  it.each([
    ["top", "n1>n2"],
    ["bottom", "n2>n1"],
  ])(
    "reads a drag from A's %s dot dropped on B's card body as %s",
    (dot, edge) => {
      render(<DesignWithState initial={LOOPS_AND_RECURSION} />);

      pointAt(screen.getByText("Recursion"));
      fireEvent.click(
        screen.getByRole("button", {
          name: `From n1 ${dot} dot to the pointer`,
        })
      );

      expect(edgesDrawn()).toBe(edge);
    }
  );

  it("draws nothing for a drop on the start card or on empty canvas", () => {
    render(<DesignWithState initial={LOOPS_AND_RECURSION} />);

    for (const under of [
      screen.getByText("Loops"),
      screen.getByTestId("react-flow"),
      null,
    ]) {
      pointAt(under);
      for (const dot of ["top", "bottom"])
        fireEvent.click(
          screen.getByRole("button", {
            name: `From n1 ${dot} dot to the pointer`,
          })
        );
    }

    expect(edgesDrawn()).toBe("");
    expect(toast.warning).not.toHaveBeenCalled();
  });

  it("keeps a reversed edge and names the edge it removed", () => {
    render(
      <DesignWithState
        initial={{
          nodes: [LOOPS, RECURSION_GUIDE],
          edges: [{ id: drawnEdgeId("n1", "n2"), source: "n1", target: "n2" }],
        }}
      />
    );

    fireEvent.click(
      screen.getByRole("button", { name: "From n1 bottom dot to n2 dot" })
    );

    expect(edgesDrawn()).toBe("n2>n1");
    expect(toast.warning).toHaveBeenCalledWith(
      "Kept Recursion → Loops; removed Loops → Recursion."
    );
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
