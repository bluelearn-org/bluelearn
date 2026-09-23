// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { ComponentType, ReactNode } from "react";
import type * as XyflowReact from "@xyflow/react";

import type { ObjectiveGraphData } from "@/types/contributions";
import { ObjectiveDesign } from "@/components/contribute/steps/objective/ObjectiveDesign";

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
    }: {
      nodes: Array<{ id: string; type: string; data: unknown }>;
      nodeTypes: Record<string, ComponentType<{ data: unknown }>>;
    }) => (
      <div data-testid="react-flow">
        {nodes.map((node) => {
          const NodeComponent = nodeTypes[node.type];
          return <NodeComponent key={node.id} data={node.data} />;
        })}
      </div>
    ),
    Background: () => null,
    Controls: () => null,
    Handle: () => null,
    useNodesState: (initial: Array<unknown>) => [initial, vi.fn(), vi.fn()],
    useEdgesState: (initial: Array<unknown>) => [initial, vi.fn(), vi.fn()],
  };
});

vi.mock("@/lib/themeProvider", () => ({
  useTheme: () => ({ theme: "light" }),
}));

vi.mock("@/components/contribute/StepperActionHeader", () => ({
  StepperActionHeader: () => null,
}));

const Stepper = {
  Content: ({ children }: { children: ReactNode }) => <div>{children}</div>,
};

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
  });

  it("renders guide, target and request cards from the draft graph", () => {
    renderDesign({
      nodes: [
        { id: "n1", type: "guide", guideSlug: "loops", title: "Loops" },
        {
          id: "n2",
          type: "target",
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
    expect(screen.getAllByText("Target")).toHaveLength(1);
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
});
