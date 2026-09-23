import { describe, expect, it } from "vitest";
import type { Walkthrough } from "@bluelearn/schemas";

import type {
  ObjectiveGraphData,
  ObjectiveGraphNode,
} from "@/types/contributions";
import {
  addGuideNode,
  addWalkthrough,
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
    const loops = {
      type: "guide" as const,
      guideBaseId: "base-loops",
      guideSlug: "loops",
      title: "L",
    };

    const once = addGuideNode({ nodes: [], edges: [] }, loops);
    const twice = addGuideNode(once, loops);

    expect(once.nodes).toHaveLength(1);
    expect(twice.nodes).toHaveLength(1);
  });

  it("adds a second guide with a different base", () => {
    const graph = addGuideNode(
      { nodes: [guide("a")], edges: [] },
      { type: "guide", guideBaseId: "base-b", guideSlug: "b", title: "b" }
    );

    expect(graph.nodes.map((n) => n.type)).toEqual(["guide", "guide"]);
    expect(new Set(graph.nodes.map((n) => n.id)).size).toBe(2);
  });

  it("keeps the target type it is given", () => {
    const graph = addGuideNode(
      { nodes: [guide("a")], edges: [] },
      { type: "target", guideBaseId: "base-b", guideSlug: "b", title: "b" }
    );

    expect(graph.nodes.map((n) => n.type)).toEqual(["guide", "target"]);
  });
});

describe("addWalkthrough", () => {
  const step = (id: string): Walkthrough["nodes"][number] => ({
    id: `base-${id}`,
    slug: id,
    title: id,
    summary: null,
    level: 1,
    duration_minutes: 5,
    tags: [],
  });

  const prerequisite = (from: string, to: string) => ({
    from_id: `base-${from}`,
    to_id: `base-${to}`,
  });

  const target: ObjectiveGraphNode = {
    id: "t",
    type: "target",
    guideBaseId: "base-t",
    guideSlug: "t",
    title: "t",
  };

  const slugs = (graph: ObjectiveGraphData) =>
    graph.nodes.map((n) => (n.type === "guide_request" ? n.id : n.guideSlug));

  const slugPairs = (graph: ObjectiveGraphData) => {
    const slugById = new Map(
      graph.nodes.map((n) => [
        n.id,
        n.type === "guide_request" ? n.id : n.guideSlug,
      ])
    );
    return graph.edges.map(
      (e) => `${slugById.get(e.source)}>${slugById.get(e.target)}`
    );
  };

  it("places the prerequisites as guides joined by guide edges", () => {
    const { graph } = addWalkthrough(
      { nodes: [target], edges: [] },
      {
        nodes: [step("a"), step("b"), step("t")],
        edges: [prerequisite("a", "b"), prerequisite("b", "t")],
      }
    );

    expect(slugs(graph)).toEqual(["t", "a", "b"]);
    expect(graph.nodes.map((n) => n.type)).toEqual([
      "target",
      "guide",
      "guide",
    ]);
    expect(slugPairs(graph)).toEqual(["a>b", "b>t"]);
    expect(graph.edges.every((e) => e.id.startsWith("g:"))).toBe(true);
  });

  it("keeps a guide already on the canvas and joins it by its own id", () => {
    const { graph } = addWalkthrough(
      { nodes: [target, guide("a")], edges: [] },
      { nodes: [step("a"), step("t")], edges: [prerequisite("a", "t")] }
    );

    expect(graph.nodes.map((n) => n.id)).toEqual(["t", "a"]);
    expect(graph.edges).toEqual([fromGuides("a", "t")]);
  });

  it("adds no guide edge where the curator already drew one", () => {
    const { graph } = addWalkthrough(
      { nodes: [target, guide("a")], edges: [drawn("a", "t")] },
      { nodes: [step("a"), step("t")], edges: [prerequisite("a", "t")] }
    );

    expect(graph.edges).toEqual([drawn("a", "t")]);
  });

  it("skips an edge with an end that is not on the canvas", () => {
    const { graph } = addWalkthrough(
      { nodes: [target], edges: [] },
      {
        nodes: [step("a"), step("t")],
        edges: [prerequisite("ghost", "t"), prerequisite("a", "t")],
      }
    );

    expect(slugPairs(graph)).toEqual(["a>t"]);
  });

  it("lets a guide edge in by removing the drawn edge it would cycle with", () => {
    const drawnFirst = connectNodes(
      { nodes: [target, guide("a")], edges: [] },
      "a",
      "t"
    );

    const { graph, removedDrawnEdges } = addWalkthrough(drawnFirst, {
      nodes: [step("a"), step("t")],
      edges: [prerequisite("t", "a")],
    });

    expect(graph.edges).toEqual([fromGuides("t", "a")]);
    expect(removedDrawnEdges).toEqual([drawn("a", "t")]);
  });

  it("removes every drawn edge on a longer path back to the source", () => {
    const { graph, removedDrawnEdges } = addWalkthrough(
      {
        nodes: [guide("a"), guide("b"), guide("c")],
        edges: [drawn("a", "b"), drawn("b", "c")],
      },
      { nodes: [step("a"), step("c")], edges: [prerequisite("c", "a")] }
    );

    expect(graph.edges).toEqual([fromGuides("c", "a")]);
    expect(removedDrawnEdges).toEqual([drawn("a", "b"), drawn("b", "c")]);
  });

  it("removes nothing for a guide edge that closes no cycle", () => {
    const { graph, removedDrawnEdges } = addWalkthrough(
      {
        nodes: [guide("a"), guide("b"), guide("c")],
        edges: [drawn("a", "b"), drawn("b", "c")],
      },
      { nodes: [step("a"), step("c")], edges: [prerequisite("a", "c")] }
    );

    expect(graph.edges).toEqual([
      drawn("a", "b"),
      drawn("b", "c"),
      fromGuides("a", "c"),
    ]);
    expect(removedDrawnEdges).toEqual([]);
  });

  it("skips a guide edge that would close a loop of guide edges only", () => {
    const { graph, removedDrawnEdges } = addWalkthrough(
      { nodes: [guide("a"), guide("b")], edges: [fromGuides("a", "b")] },
      { nodes: [step("a"), step("b")], edges: [prerequisite("b", "a")] }
    );

    expect(graph.edges).toEqual([fromGuides("a", "b")]);
    expect(removedDrawnEdges).toEqual([]);
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
