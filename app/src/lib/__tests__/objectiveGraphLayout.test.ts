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
  it("puts a request that a target needs below the target", () => {
    const positions = positionsOf({
      nodes: [targetGuide("t"), request("r"), guide("g")],
      edges: [edge("r", "t")],
    });

    expect(positions.get("r")!.y).toBeGreaterThan(positions.get("t")!.y);
  });

  it("puts an existing guide that needs a request above the request", () => {
    const positions = positionsOf({
      nodes: [guide("g"), request("r")],
      edges: [edge("r", "g")],
    });

    expect(positions.get("g")!.y).toBeLessThan(positions.get("r")!.y);
  });

  it("falls back by kind without edges: existing at the bottom, then request, then target, whatever the input order", () => {
    for (const nodes of [
      [guide("g"), request("r"), targetGuide("t")],
      [targetGuide("t"), request("r"), guide("g")],
    ]) {
      const positions = positionsOf({ nodes, edges: [] });

      expect(positions.get("g")!.y).toBe(300);
      expect(positions.get("r")!.y).toBe(150);
      expect(positions.get("t")!.y).toBe(0);
    }
  });

  it("moves a node out of its fallback row once an edge places it", () => {
    const nodes = [guide("g"), request("r"), targetGuide("t")];
    const loose = positionsOf({ nodes, edges: [] });
    const linked = positionsOf({ nodes, edges: [edge("t", "g")] });

    expect(loose.get("t")!.y).toBeLessThan(loose.get("g")!.y);
    expect(linked.get("t")!.y).toBeGreaterThan(linked.get("g")!.y);
  });

  it("orders a row existing, request, target, then by input order", () => {
    const positions = positionsOf({
      nodes: [
        targetGuide("t"),
        request("r"),
        guide("g2"),
        guide("g1"),
        guide("x"),
      ],
      edges: ["t", "r", "g2", "g1"].map((id) => edge(id, "x")),
    });

    const row = ["g2", "g1", "r", "t"].map((id) => positions.get(id)!);
    expect(new Set(row.map((p) => p.y)).size).toBe(1);
    expect(row.map((p) => p.x)).toEqual(
      [...row.map((p) => p.x)].sort((a, b) => a - b)
    );
  });

  it("closes the gap an empty fallback row would leave", () => {
    const positions = positionsOf({
      nodes: [request("r"), guide("g")],
      edges: [],
    });

    expect(positions.get("g")!.y).toBe(150);
    expect(positions.get("r")!.y).toBe(0);
  });

  it("puts a dependent above its prerequisite", () => {
    const positions = positionsOf({
      nodes: [guide("b"), guide("a")],
      edges: [edge("a", "b")],
    });

    expect(positions.get("b")!.y).toBeLessThan(positions.get("a")!.y);
  });

  it("puts a target on the top row even when nothing leads to it", () => {
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
