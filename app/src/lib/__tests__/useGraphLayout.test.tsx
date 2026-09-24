// @vitest-environment jsdom
import {
  render,
  renderHook,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { Position } from "@xyflow/react";
import type * as ReactType from "react";
import type { Walkthrough } from "@bluelearn/schemas";
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
    Position: { Bottom: "bottom", Top: "top" },
    useEdgesState: useCollectionState,
    useNodesState: useCollectionState,
  };
});

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
    const { result } = renderHook(() =>
      useGraphLayout({
        walkthroughData,
        targetSlug: "target",
        hoveredGuide: null,
        nodeType: "walkthroughNode",
        nodeWidth: 320,
        nodeSpacing: 560,
      })
    );

    await waitFor(() => expect(result.current.nodes).toHaveLength(3));

    const positions = new Map(
      result.current.nodes.map((node) => [node.id, node.position.y])
    );
    expect(positions.get("prerequisite")).toBeGreaterThan(
      positions.get("target")!
    );
    expect(positions.get("target")).toBeGreaterThan(
      positions.get("follow-up")!
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

  it("connects edges through the facing sides of each node", () => {
    const data: GraphNodeData = {
      title: "Target",
      level: 2,
      summary: null,
      duration_minutes: 10,
      tags: [],
      isTarget: true,
      isHovered: false,
      isDimmed: false,
      centerX: 0,
    };

    render(<GuideGraphNode data={data} isSelected={false} />);

    expect(screen.getByTestId("target-handle").dataset.position).toBe("bottom");
    expect(screen.getByTestId("source-handle").dataset.position).toBe("top");
  });

  // Handles and Card are both positioned with no z-index, so the later one in
  // the DOM paints on top and takes the click.
  it("paints both handles over the card, on the default sides and on an override", () => {
    const data: GraphNodeData = {
      title: "Target",
      level: 2,
      summary: null,
      duration_minutes: 10,
      tags: [],
      isTarget: true,
      isHovered: false,
      isDimmed: false,
      centerX: 0,
    };
    const paintsOverCard = (container: HTMLElement, handle: HTMLElement) =>
      Boolean(
        container
          .querySelector('[data-slot="card"]')!
          .compareDocumentPosition(handle) & Node.DOCUMENT_POSITION_FOLLOWING
      );

    const plain = render(<GuideGraphNode data={data} isSelected={false} />);
    const plainTarget = within(plain.container).getByTestId("target-handle");
    const plainSource = within(plain.container).getByTestId("source-handle");

    expect(paintsOverCard(plain.container, plainTarget)).toBe(true);
    expect(paintsOverCard(plain.container, plainSource)).toBe(true);
    expect(plainTarget.dataset.position).toBe("bottom");
    expect(plainSource.dataset.position).toBe("top");

    const flipped = render(
      <GuideGraphNode
        data={data}
        isSelected={false}
        handles={{
          target: Position.Top,
          source: Position.Bottom,
          className: "canvas-dot",
        }}
      />
    );
    const flippedTarget = within(flipped.container).getByTestId(
      "target-handle"
    );
    const flippedSource = within(flipped.container).getByTestId(
      "source-handle"
    );

    expect(paintsOverCard(flipped.container, flippedTarget)).toBe(true);
    expect(paintsOverCard(flipped.container, flippedSource)).toBe(true);
    expect(flippedTarget.dataset.position).toBe("top");
    expect(flippedSource.dataset.position).toBe("bottom");
    expect(flippedTarget.className).toBe("canvas-dot");
  });
});
