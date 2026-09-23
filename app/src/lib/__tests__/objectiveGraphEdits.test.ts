import { describe, expect, it } from "vitest";

import type {
  ObjectiveGraphData,
  ObjectiveGraphNode,
} from "@/types/contributions";
import {
  addGuideNode,
  connectNodes,
  drawnEdgeId,
  graphToApi,
  guideEdgeId,
  removeEdges,
  removeNodes,
} from "@/lib/objectiveGraphEdits";

const guide = (id: string): ObjectiveGraphNode => ({
  id,
  type: "guide",
  guideBaseId: `base-${id}`,
  guideSlug: id,
  title: id,
});

const request = (id: string): ObjectiveGraphNode => ({
  id,
  type: "guide_request",
  title: `${id} title`,
  summary: `${id} summary`,
});

const drawn = (source: string, target: string) => ({
  id: drawnEdgeId(source, target),
  source,
  target,
});

const fromGuides = (source: string, target: string) => ({
  id: guideEdgeId(source, target),
  source,
  target,
});

const pairs = (graph: ObjectiveGraphData) =>
  graph.edges.map((e) => `${e.source}>${e.target}`);

describe("addGuideNode", () => {
  it("adds a guide once, however many times it is added", () => {
    const loops = { guideBaseId: "base-loops", guideSlug: "loops", title: "L" };

    const once = addGuideNode({ nodes: [], edges: [] }, loops);
    const twice = addGuideNode(once, loops);

    expect(once.nodes).toHaveLength(1);
    expect(twice.nodes).toHaveLength(1);
  });

  it("adds a second guide with a different base", () => {
    const graph = addGuideNode(
      { nodes: [guide("a")], edges: [] },
      { guideBaseId: "base-b", guideSlug: "b", title: "b" }
    );

    expect(graph.nodes.map((n) => n.type)).toEqual(["guide", "guide"]);
    expect(new Set(graph.nodes.map((n) => n.id)).size).toBe(2);
  });
});

describe("connectNodes", () => {
  const graph: ObjectiveGraphData = {
    nodes: [guide("a"), guide("b"), guide("c")],
    edges: [],
  };

  it("draws an edge between two known nodes", () => {
    expect(pairs(connectNodes(graph, "a", "b"))).toEqual(["a>b"]);
  });

  it("refuses a self-loop", () => {
    expect(pairs(connectNodes(graph, "a", "a"))).toEqual([]);
  });

  it("refuses a duplicate", () => {
    const once = connectNodes(graph, "a", "b");

    expect(pairs(connectNodes(once, "a", "b"))).toEqual(["a>b"]);
  });

  it("refuses an unknown id on either end", () => {
    expect(pairs(connectNodes(graph, "a", "ghost"))).toEqual([]);
    expect(pairs(connectNodes(graph, "ghost", "a"))).toEqual([]);
  });

  it("refuses the edge that would close a cycle", () => {
    const chain = connectNodes(connectNodes(graph, "a", "b"), "b", "c");

    expect(pairs(connectNodes(chain, "c", "a"))).toEqual(["a>b", "b>c"]);
  });

  it("allows a shortcut that closes no cycle", () => {
    const chain = connectNodes(connectNodes(graph, "a", "b"), "b", "c");

    expect(pairs(connectNodes(chain, "a", "c"))).toEqual(["a>b", "b>c", "a>c"]);
  });
});

describe("removeNodes", () => {
  it("drops the nodes and every edge touching them, keeping the rest", () => {
    const graph = removeNodes(
      {
        nodes: [guide("a"), guide("b"), guide("c")],
        edges: [drawn("a", "b"), fromGuides("b", "c"), drawn("a", "c")],
      },
      ["b"]
    );

    expect(graph.nodes.map((n) => n.id)).toEqual(["a", "c"]);
    expect(pairs(graph)).toEqual(["a>c"]);
  });
});

describe("removeEdges", () => {
  const graph: ObjectiveGraphData = {
    nodes: [guide("a"), guide("b"), guide("c")],
    edges: [drawn("a", "b"), fromGuides("b", "c")],
  };

  it("removes a drawn edge", () => {
    expect(pairs(removeEdges(graph, [drawnEdgeId("a", "b")]))).toEqual(["b>c"]);
  });

  it("ignores an edge that comes from the guides", () => {
    expect(pairs(removeEdges(graph, [guideEdgeId("b", "c")]))).toEqual([
      "a>b",
      "b>c",
    ]);
  });
});

describe("graphToApi", () => {
  it("sends drawn edges only, with guide and request node shapes", () => {
    const body = graphToApi({
      nodes: [guide("a"), request("r"), guide("c")],
      edges: [drawn("a", "r"), fromGuides("a", "c")],
    });

    expect(body).toEqual({
      nodes: [
        { id: "a", guide_base_id: "base-a" },
        { id: "r", title: "r title", summary: "r summary" },
        { id: "c", guide_base_id: "base-c" },
      ],
      edges: [{ from_node_id: "a", to_node_id: "r" }],
    });
  });
});
