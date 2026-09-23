import { describe, expect, it } from "vitest";

import type {
  ObjectiveGraphData,
  ObjectiveGraphNode,
} from "@/types/contributions";
import { layoutObjectiveGraph } from "@/lib/objectiveGraphLayout";

const OPTIONS = { nodeWidth: 200, nodeSpacing: 300, levelSpacing: 150 };

const guide = (id: string): ObjectiveGraphNode => ({
  id,
  type: "guide",
  guideBaseId: id,
  guideSlug: id,
  title: id,
});

const edge = (source: string, target: string) => ({
  id: `${source}-${target}`,
  source,
  target,
});

function positionsOf(graph: ObjectiveGraphData) {
  return new Map(
    layoutObjectiveGraph(graph, OPTIONS).map((n) => [n.id, n.position])
  );
}

describe("layoutObjectiveGraph", () => {
  it("puts a dependent above its prerequisite", () => {
    const positions = positionsOf({
      nodes: [guide("b"), guide("a")],
      edges: [edge("a", "b")],
    });

    expect(positions.get("b")!.y).toBeLessThan(positions.get("a")!.y);
  });

  it("puts a target on the top row even when nothing leads to it", () => {
    const positions = positionsOf({
      nodes: [
        {
          id: "t",
          type: "target",
          guideBaseId: "t",
          guideSlug: "t",
          title: "t",
        },
        guide("a"),
        guide("b"),
        guide("c"),
      ],
      edges: [edge("a", "b"), edge("b", "c")],
    });

    const targetY = positions.get("t")!.y;
    for (const id of ["a", "b", "c"]) {
      expect(targetY).toBeLessThanOrEqual(positions.get(id)!.y);
    }
    expect(targetY).toBeLessThan(positions.get("a")!.y);
  });

  it("gives two nodes on one level distinct x", () => {
    const positions = positionsOf({
      nodes: [guide("a"), guide("b"), guide("c")],
      edges: [edge("a", "b"), edge("a", "c")],
    });

    expect(positions.get("b")!.y).toBe(positions.get("c")!.y);
    expect(positions.get("b")!.x).not.toBe(positions.get("c")!.x);
  });

  it("keeps nodes without edges on one level", () => {
    const positions = positionsOf({
      nodes: [guide("a"), guide("b"), guide("c")],
      edges: [],
    });

    const ys = new Set([...positions.values()].map((p) => p.y));
    expect(ys.size).toBe(1);
  });

  it("uses the longest path, not the shortest, to place a node", () => {
    // a -> b -> c and a -> c: c must sit above b, not beside it.
    const positions = positionsOf({
      nodes: [guide("a"), guide("b"), guide("c")],
      edges: [edge("a", "c"), edge("a", "b"), edge("b", "c")],
    });

    expect(positions.get("c")!.y).toBeLessThan(positions.get("b")!.y);
  });
});
