// @vitest-environment jsdom
import {
  cleanup,
  render,
  renderHook,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type * as ReactType from "react";
import type { Walkthrough } from "@bluelearn/schemas";
import type { GraphOrientation } from "@/lib/graphOrientation";
import type { GraphNodeData } from "@/lib/useGraphLayout";
import { GuideGraphNode } from "@/components/graph/GuideGraphNode";
import {
  getTargetPrerequisiteWalkthrough,
  useGraphLayout,
} from "@/lib/useGraphLayout";

vi.mock("@xyflow/react", async () => {
  const React = await vi.importActual<typeof ReactType>("react");

  const useCollectionState = <TItem,>(initialValue: Array<TItem>) => {
    const [items, setItems] = React.useState(initialValue);
    return [items, setItems, vi.fn()] as const;
  };

  return {
    Handle: ({
      type,
      position,
      className,
    }: {
      type: string;
      position: string;
      className?: string;
    }) =>
      React.createElement("div", {
        "data-testid": `${type}-handle`,
        "data-position": position,
        className,
      }),
    MarkerType: { ArrowClosed: "arrow-closed" },
    Position: { Bottom: "bottom", Top: "top", Left: "left", Right: "right" },
    useEdgesState: useCollectionState,
    useNodesState: useCollectionState,
  };
});

// Lays the three-node chain out and returns each node's position by slug.
async function layoutPositions(orientation?: GraphOrientation) {
  const { result } = renderHook(() =>
    useGraphLayout({
      walkthroughData,
      targetSlug: "target",
      hoveredGuide: null,
      nodeType: "walkthroughNode",
      nodeWidth: 320,
      nodeSpacing: 560,
      orientation,
    })
  );

  await waitFor(() => expect(result.current.nodes).toHaveLength(3));

  return new Map(result.current.nodes.map((node) => [node.id, node.position]));
}

const walkthroughData: Walkthrough = {
  nodes: [
    {
      id: "prerequisite-id",
      slug: "prerequisite",
      title: "Prerequisite",
      level: 1,
      summary: null,
      duration_minutes: 10,
      tags: [],
    },
    {
      id: "target-id",
      slug: "target",
      title: "Target",
      level: 2,
      summary: null,
      duration_minutes: 10,
      tags: [],
    },
    {
      id: "follow-up-id",
      slug: "follow-up",
      title: "Follow-up",
      level: 3,
      summary: null,
      duration_minutes: 10,
      tags: [],
    },
  ],
  edges: [
    { from_id: "prerequisite-id", to_id: "target-id" },
    { from_id: "target-id", to_id: "follow-up-id" },
  ],
};

afterEach(cleanup);

describe("walkthrough graph direction", () => {
  it("keeps objective curation on the target's prerequisite graph", () => {
    const prerequisiteWalkthrough = getTargetPrerequisiteWalkthrough(
      {
        ...walkthroughData,
        nodes: walkthroughData.nodes.map((node) =>
          node.slug === "follow-up" ? { ...node, level: 1 } : node
        ),
      },
      "target"
    );

    expect(prerequisiteWalkthrough.nodes.map((node) => node.slug)).toEqual([
      "prerequisite",
      "target",
    ]);
    expect(prerequisiteWalkthrough.edges).toEqual([
      { from_id: "prerequisite-id", to_id: "target-id" },
    ]);
    expect(
      getTargetPrerequisiteWalkthrough(walkthroughData, "missing")
    ).toEqual({ nodes: [], edges: [] });
  });

  it("places prerequisites below the target and follow-ups above it", async () => {
    const positions = await layoutPositions();

    expect(positions.get("prerequisite")!.y).toBeGreaterThan(
      positions.get("target")!.y
    );
    expect(positions.get("target")!.y).toBeGreaterThan(
      positions.get("follow-up")!.y
    );
  });

  it("reads top-down with prerequisites above the target", async () => {
    const positions = await layoutPositions("top-down");

    expect(positions.get("prerequisite")!.y).toBeLessThan(
      positions.get("target")!.y
    );
    expect(positions.get("target")!.y).toBeLessThan(
      positions.get("follow-up")!.y
    );
  });

  it("runs left to right along the x axis, keeping a level's nodes in one column", async () => {
    const positions = await layoutPositions("left-right");

    expect(positions.get("prerequisite")!.x).toBeLessThan(
      positions.get("target")!.x
    );
    expect(positions.get("target")!.x).toBeLessThan(
      positions.get("follow-up")!.x
    );
    // One node per level, so every level centers on the same row.
    expect(new Set([...positions.values()].map((p) => p.y)).size).toBe(1);
  });

  it("runs right to left with the target left of its prerequisites", async () => {
    const positions = await layoutPositions("right-left");

    expect(positions.get("prerequisite")!.x).toBeGreaterThan(
      positions.get("target")!.x
    );
    expect(positions.get("target")!.x).toBeGreaterThan(
      positions.get("follow-up")!.x
    );
  });

  it("gives distinct edge IDs to hyphen-colliding slug pairs", async () => {
    const collisionWalkthrough: Walkthrough = {
      nodes: ["a-b", "a", "c", "b-c"].map((slug, index) => ({
        id: slug,
        slug,
        title: slug,
        level: index < 2 ? 1 : 2,
        summary: null,
        duration_minutes: 10,
        tags: [],
      })),
      edges: [
        { from_id: "a-b", to_id: "c" },
        { from_id: "a", to_id: "b-c" },
      ],
    };
    const { result } = renderHook(() =>
      useGraphLayout({
        walkthroughData: collisionWalkthrough,
        targetSlug: "c",
        hoveredGuide: null,
        nodeType: "walkthroughNode",
        nodeWidth: 320,
        nodeSpacing: 560,
      })
    );

    await waitFor(() => expect(result.current.edges).toHaveLength(2));

    expect(
      result.current.edges.map(({ source, target }) => [source, target])
    ).toEqual([
      ["a-b", "c"],
      ["a", "b-c"],
    ]);
    expect(new Set(result.current.edges.map((edge) => edge.id)).size).toBe(2);
  });

  const nodeData: GraphNodeData = {
    title: "Target",
    level: 2,
    summary: null,
    duration_minutes: 10,
    tags: [],
    isTarget: true,
    isHovered: false,
    isDimmed: false,
    orientation: "bottom-up",
    centerX: 0,
    centerY: null,
  };

  it("connects edges through the facing sides of each node", () => {
    render(<GuideGraphNode data={nodeData} isSelected={false} />);

    expect(screen.getByTestId("target-handle").dataset.position).toBe("bottom");
    expect(screen.getByTestId("source-handle").dataset.position).toBe("top");
  });

  it.each([
    { orientation: "top-down", target: "top", source: "bottom" },
    { orientation: "left-right", target: "left", source: "right" },
    { orientation: "right-left", target: "right", source: "left" },
  ] as const)(
    "turns the handles with a $orientation layout",
    ({ orientation, target, source }) => {
      render(
        <GuideGraphNode
          data={{ ...nodeData, orientation }}
          isSelected={false}
        />
      );

      expect(screen.getByTestId("target-handle").dataset.position).toBe(target);
      expect(screen.getByTestId("source-handle").dataset.position).toBe(source);
    }
  );
});
