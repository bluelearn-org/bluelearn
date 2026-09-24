import { describe, expect, it } from "vitest";

import type {
  ObjectiveGraphData,
  ObjectiveGraphNode,
} from "@/types/contributions";
import { layoutObjectiveGraph } from "@/lib/objectiveGraphLayout";

const OPTIONS = { nodeWidth: 200, nodeSpacing: 300, bandSpacing: 150 };

const guide = (id: string): ObjectiveGraphNode => ({
  id,
  type: "guide",
  guideBaseId: id,
  guideSlug: id,
  title: id,
});

const targetGuide = (id: string): ObjectiveGraphNode => ({
  id,
  type: "target",
  guideBaseId: id,
  guideSlug: id,
  title: id,
});

const request = (id: string): ObjectiveGraphNode => ({
  id,
  type: "guide_request",
  title: id,
  summary: id,
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
  it("stacks existing guides, then targets, then requests, whatever the input order or edges", () => {
    // The request leads to the guide and the guide to the target: depth alone
    // would put the guide above the request.
    const edges = [edge("r", "g"), edge("g", "t")];
    const forward = positionsOf({
      nodes: [guide("g"), targetGuide("t"), request("r")],
      edges,
    });
    const reversed = positionsOf({
      nodes: [request("r"), targetGuide("t"), guide("g")],
      edges,
    });

    for (const positions of [forward, reversed]) {
      expect(positions.get("g")!.y).toBe(300);
      expect(positions.get("t")!.y).toBe(150);
      expect(positions.get("r")!.y).toBe(0);
    }
  });

  it("closes the gap an empty band would leave", () => {
    const positions = positionsOf({
      nodes: [request("r"), guide("g")],
      edges: [],
    });

    expect(positions.get("g")!.y).toBe(150);
    expect(positions.get("r")!.y).toBe(0);
  });

  it("keeps a dependent guide in its prerequisite's band, to its right", () => {
    const positions = positionsOf({
      nodes: [guide("b"), guide("a")],
      edges: [edge("a", "b")],
    });

    expect(positions.get("b")!.y).toBe(positions.get("a")!.y);
    expect(positions.get("b")!.x).toBeGreaterThan(positions.get("a")!.x);
  });

  it("puts a target above every existing guide even when nothing leads to it", () => {
    const positions = positionsOf({
      nodes: [targetGuide("t"), guide("a"), guide("b"), guide("c")],
      edges: [edge("a", "b"), edge("b", "c")],
    });

    const targetY = positions.get("t")!.y;
    for (const id of ["a", "b", "c"]) {
      expect(targetY).toBeLessThanOrEqual(positions.get(id)!.y);
    }
    expect(targetY).toBeLessThan(positions.get("a")!.y);
  });

  it("gives two nodes in one band distinct x", () => {
    const positions = positionsOf({
      nodes: [guide("a"), guide("b"), guide("c")],
      edges: [edge("a", "b"), edge("a", "c")],
    });

    expect(positions.get("b")!.y).toBe(positions.get("c")!.y);
    expect(positions.get("b")!.x).not.toBe(positions.get("c")!.x);
  });

  it("keeps nodes without edges in one band", () => {
    const positions = positionsOf({
      nodes: [guide("a"), guide("b"), guide("c")],
      edges: [],
    });

    const ys = new Set([...positions.values()].map((p) => p.y));
    expect(ys.size).toBe(1);
  });

  it("orders a band by the longest path, not the shortest", () => {
    // a -> b -> c and a -> c: c must sit right of b, not tie with it.
    const positions = positionsOf({
      nodes: [guide("c"), guide("a"), guide("b")],
      edges: [edge("a", "c"), edge("a", "b"), edge("b", "c")],
    });

    expect(positions.get("c")!.x).toBeGreaterThan(positions.get("b")!.x);
  });
});
