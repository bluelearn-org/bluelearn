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
      nodes: [guide("t"), request("r"), guide("g")],
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

  it("puts every node without edges on the top row: nothing leads out of it", () => {
    const positions = positionsOf({
      nodes: [guide("g"), request("r"), guide("t")],
      edges: [],
    });

    expect([...positions.values()].map((p) => p.y)).toEqual([0, 0, 0]);
  });

  it("moves a node off the top row once an edge leads out of it", () => {
    const nodes = [guide("g"), request("r"), guide("t")];
    const loose = positionsOf({ nodes, edges: [] });
    const linked = positionsOf({ nodes, edges: [edge("t", "g")] });

    expect(loose.get("t")!.y).toBe(loose.get("g")!.y);
    expect(linked.get("t")!.y).toBeGreaterThan(linked.get("g")!.y);
  });

  it("orders a row guide, request, target, then by input order", () => {
    // Row one holds x (a target), y and r (both lead on to z).
    const positions = positionsOf({
      nodes: [
        guide("x"),
        request("r"),
        guide("y2"),
        guide("y1"),
        guide("a"),
        guide("z"),
      ],
      edges: [
        edge("a", "x"),
        edge("a", "r"),
        edge("a", "y2"),
        edge("a", "y1"),
        edge("r", "z"),
        edge("y2", "z"),
        edge("y1", "z"),
      ],
    });

    const row = ["y2", "y1", "r", "x"].map((id) => positions.get(id)!);
    expect(new Set(row.map((p) => p.y)).size).toBe(1);
    expect(row.map((p) => p.x)).toEqual(
      [...row.map((p) => p.x)].sort((a, b) => a - b)
    );
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
      nodes: [guide("t"), guide("a"), guide("b"), guide("c")],
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

  it("uses the longest path, not the shortest, to place a node", () => {
    // a -> b -> c and a -> c: c must sit above b, not beside it.
    const positions = positionsOf({
      nodes: [guide("a"), guide("b"), guide("c")],
      edges: [edge("a", "c"), edge("a", "b"), edge("b", "c")],
    });

    expect(positions.get("c")!.y).toBeLessThan(positions.get("b")!.y);
  });

  it("stands two edge groups and a loose node side by side, top rows aligned, centred on x = 0", () => {
    // Island a -> b -> c (three rows), island d -> e (two rows), loose t.
    const nodes = [
      guide("t"),
      guide("d"),
      guide("a"),
      guide("e"),
      guide("b"),
      guide("c"),
    ];
    const edges = [edge("a", "b"), edge("b", "c"), edge("d", "e")];
    const positions = positionsOf({ nodes, edges });
    const at = (id: string) => positions.get(id)!;

    // d comes first in the input, so its island stands leftmost; loose last.
    // Each block is one card wide (300) with a 300 gap: centres -600, 0, 600.
    expect(at("d").x).toBe(-600 - 100);
    expect(at("a").x).toBe(-100);
    expect(at("t").x).toBe(600 - 100);

    expect([at("e").y, at("c").y, at("t").y]).toEqual([0, 0, 0]);
    expect(at("d").y).toBe(150);
    expect(at("a").y).toBe(300);

    // An edge inside one island leaves the others in their places.
    const grown = positionsOf({
      nodes: [...nodes, guide("f")],
      edges: [...edges, edge("c", "f")],
    });
    expect(grown.get("d")!.x).toBe(at("d").x);
    expect(grown.get("a")!.x).toBe(at("a").x);
    expect(grown.get("t")!.x).toBe(at("t").x);
  });

  it("lines loose nodes up with the deepest island's top row", () => {
    const positions = positionsOf({
      nodes: [guide("a"), guide("b"), guide("c"), guide("g"), request("r")],
      edges: [edge("a", "b"), edge("b", "c")],
    });

    expect(positions.get("g")!.y).toBe(positions.get("c")!.y);
    expect(positions.get("r")!.y).toBe(positions.get("c")!.y);
    expect(positions.get("g")!.x).toBeGreaterThan(positions.get("a")!.x);
  });
});
