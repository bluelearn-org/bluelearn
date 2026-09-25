import { describe, expect, it } from "vitest";
import type { Walkthrough } from "@bluelearn/schemas";

import type {
  ObjectiveContribution,
  ObjectiveGraphData,
  ObjectiveGraphNode,
} from "@/types/contributions";
import {
  addGuideNode,
  addWalkthrough,
  adoptSavedSnapshot,
  connectNodes,
  drawnEdgeId,
  edgesCutByConnecting,
  graphToApi,
  guideEdgeId,
  prerequisiteWalkthrough,
  removeEdges,
  removeNodes,
  targetNodeIds,
  withLiveTargets,
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
      { guideBaseId: "base-b", guideSlug: "b", title: "b" }
    );

    expect(new Set(graph.nodes.map((n) => n.id)).size).toBe(2);
  });
});

describe("targetNodeIds", () => {
  it("marks every node nothing leads out of, over drawn and guide edges", () => {
    const graph: ObjectiveGraphData = {
      nodes: [guide("a"), guide("b"), request("r"), guide("c")],
      edges: [fromGuides("a", "b"), drawn("b", "r")],
    };

    expect([...targetNodeIds(graph)]).toEqual(["r", "c"]);
  });

  it("makes a request with no follow-up a target", () => {
    const graph: ObjectiveGraphData = {
      nodes: [guide("a"), request("r")],
      edges: [drawn("a", "r")],
    };

    expect([...targetNodeIds(graph)]).toEqual(["r"]);
  });
});

const draft = (
  graph: ObjectiveGraphData,
  curation: Partial<ObjectiveContribution> = {}
): ObjectiveContribution => ({
  title: "",
  summary: "",
  changeSummary: "",
  targets: [],
  featuredSubObjective: "",
  subObjectives: [],
  subjects: [],
  graph,
  ...curation,
});

describe("withLiveTargets", () => {
  it("keeps the curator's order and appends a newcomer", () => {
    const graph: ObjectiveGraphData = {
      nodes: [guide("a"), guide("b"), request("r")],
      edges: [],
    };

    const next = withLiveTargets(draft(graph, { targets: ["b", "a"] }), graph);

    expect(next.targets).toEqual(["b", "a", "r"]);
  });

  it("drops a target that gains a follow-up, and its featured flag", () => {
    const before: ObjectiveGraphData = {
      nodes: [request("r"), guide("b")],
      edges: [],
    };
    const after = connectNodes(before, "r", "b");

    const next = withLiveTargets(
      draft(before, { targets: ["r", "b"], featuredSubObjective: "r" }),
      after
    );

    expect(next.targets).toEqual(["b"]);
    expect(next.featuredSubObjective).toBe("");
    expect(next.graph).toBe(after);
  });
});

describe("adoptSavedSnapshot", () => {
  const stored = (
    id: string,
    baseId: string | null,
    target?: { position: number | null; featured?: boolean }
  ) => ({
    id,
    guide_base_id: baseId,
    is_target: target !== undefined,
    is_featured: target?.featured ?? false,
    target_position: target?.position ?? null,
  });
  const snapshot = (
    nodes: Array<ReturnType<typeof stored>>,
    rawEdges: Array<[string, string]> = []
  ) => ({
    nodes: nodes.map((n) => ({
      guide_id: null,
      slug: null,
      title: null,
      summary: null,
      request_id: null,
      is_included: true,
      note: null,
      ...n,
    })),
    raw_edges: rawEdges.map(([from, to]) => ({
      from_id: `base-${from}`,
      to_id: `base-${to}`,
    })),
  });

  it("adopts the server's targets and the guides' own edges without moving nodes", () => {
    const graph: ObjectiveGraphData = {
      nodes: [guide("b"), guide("a")],
      edges: [],
    };

    const next = adoptSavedSnapshot(
      draft(graph, { targets: ["b", "a"], featuredSubObjective: "a" }),
      snapshot(
        [
          stored("a", "base-a"),
          stored("b", "base-b", { position: 0, featured: true }),
        ],
        [["a", "b"]]
      )
    );

    expect(next.graph.nodes).toEqual(graph.nodes);
    expect(next.graph.edges).toEqual([fromGuides("a", "b")]);
    expect(next.targets).toEqual(["b"]);
    expect(next.featuredSubObjective).toBe("b");
  });

  it("orders targets by the server's position, newcomers after", () => {
    const graph: ObjectiveGraphData = {
      nodes: [guide("a"), guide("b"), request("late")],
      edges: [],
    };

    const next = adoptSavedSnapshot(
      draft(graph, { targets: ["a", "b", "late"] }),
      snapshot([
        stored("a", "base-a", { position: 1 }),
        stored("b", "base-b", { position: 0 }),
      ])
    );

    expect(next.targets).toEqual(["b", "a", "late"]);
  });

  it("re-keys a re-added guide to its stored id everywhere it is named", () => {
    const graph: ObjectiveGraphData = {
      nodes: [guide("fresh"), request("r")],
      edges: [drawn("fresh", "r")],
    };
    const next = adoptSavedSnapshot(
      draft(graph, {
        targets: ["r"],
        featuredSubObjective: "r",
        subObjectives: [
          {
            targetNodeId: "r",
            selectedNodeIds: ["fresh"],
            curatedSequence: ["fresh"],
          },
        ],
      }),
      snapshot([
        stored("kept", "base-fresh"),
        stored("r", null, { position: 0, featured: true }),
      ])
    );

    expect(next.graph.nodes.map((n) => n.id)).toEqual(["kept", "r"]);
    expect(next.graph.edges).toEqual([drawn("kept", "r")]);
    expect(next.targets).toEqual(["r"]);
    expect(next.subObjectives[0].curatedSequence).toEqual(["kept"]);
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
    type: "guide",
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

  it("refuses a self-loop, cutting nothing", () => {
    const chain = connectNodes(graph, "a", "b");

    expect(pairs(connectNodes(chain, "a", "a"))).toEqual(["a>b"]);
    expect(edgesCutByConnecting(chain, "a", "a")).toEqual([]);
  });

  it("refuses a duplicate, cutting nothing", () => {
    const once = connectNodes(graph, "a", "b");

    expect(pairs(connectNodes(once, "a", "b"))).toEqual(["a>b"]);
    expect(edgesCutByConnecting(once, "a", "b")).toEqual([]);
  });

  it("refuses an unknown id on either end", () => {
    expect(pairs(connectNodes(graph, "a", "ghost"))).toEqual([]);
    expect(pairs(connectNodes(graph, "ghost", "a"))).toEqual([]);
  });

  it("keeps the reversed edge and cuts the one it contradicts", () => {
    const once = connectNodes(graph, "a", "b");

    expect(edgesCutByConnecting(once, "b", "a")).toEqual([drawn("a", "b")]);
    expect(pairs(connectNodes(once, "b", "a"))).toEqual(["b>a"]);
  });

  it("cuts every edge of a longer path back, keeping the node between", () => {
    const chain: ObjectiveGraphData = {
      nodes: [guide("a"), guide("x"), guide("b")],
      edges: [drawn("a", "x"), drawn("x", "b")],
    };

    const connected = connectNodes(chain, "b", "a");

    expect(edgesCutByConnecting(chain, "b", "a")).toEqual([
      drawn("a", "x"),
      drawn("x", "b"),
    ]);
    expect(pairs(connected)).toEqual(["b>a"]);
    expect(connected.nodes.map((n) => n.id)).toEqual(["a", "x", "b"]);
  });

  it("cuts an imported prerequisite the drawn edge contradicts", () => {
    const imported: ObjectiveGraphData = {
      ...graph,
      edges: [fromGuides("a", "b"), fromGuides("b", "c")],
    };

    expect(pairs(connectNodes(imported, "b", "a"))).toEqual(["b>c", "b>a"]);
  });

  it("cuts nothing when a shortcut closes no cycle", () => {
    const chain = connectNodes(connectNodes(graph, "a", "b"), "b", "c");

    expect(edgesCutByConnecting(chain, "a", "c")).toEqual([]);
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

describe("prerequisiteWalkthrough", () => {
  const step = (id: string): Walkthrough["nodes"][number] => ({
    id: `base-${id}`,
    slug: id,
    title: `${id} from the guide`,
    summary: `${id} summary`,
    level: 7,
    duration_minutes: 5,
    tags: [{ slug: "math", name: "Math" }],
  });

  const prerequisite = (from: string, to: string) => ({
    from_id: `base-${from}`,
    to_id: `base-${to}`,
  });

  const levels = (walkthrough: Walkthrough) =>
    Object.fromEntries(walkthrough.nodes.map((n) => [n.id, n.level]));

  it("lists a guide target's own prerequisites and the arrows drawn into it", () => {
    const walkthrough = prerequisiteWalkthrough(
      {
        nodes: [guide("arithmetic"), guide("fractions"), guide("algebra")],
        edges: [drawn("fractions", "algebra")],
      },
      "algebra",
      {
        nodes: [step("arithmetic"), step("algebra")],
        edges: [prerequisite("arithmetic", "algebra")],
      }
    );

    expect(levels(walkthrough)).toEqual({
      arithmetic: 0,
      fractions: 0,
      algebra: 1,
    });
    expect(walkthrough.edges).toEqual([
      { from_id: "fractions", to_id: "algebra" },
      { from_id: "arithmetic", to_id: "algebra" },
    ]);
    expect(walkthrough.nodes.find((n) => n.id === "arithmetic")).toEqual({
      ...step("arithmetic"),
      id: "arithmetic",
      slug: "arithmetic",
      level: 0,
    });
  });

  it("lists an edge held by both the canvas and the walkthrough once", () => {
    const walkthrough = prerequisiteWalkthrough(
      {
        nodes: [guide("arithmetic"), guide("algebra")],
        edges: [fromGuides("arithmetic", "algebra")],
      },
      "algebra",
      {
        nodes: [step("arithmetic"), step("algebra")],
        edges: [prerequisite("arithmetic", "algebra")],
      }
    );

    expect(walkthrough.edges).toEqual([
      { from_id: "arithmetic", to_id: "algebra" },
    ]);
  });

  it("leaves out a walkthrough prerequisite the canvas does not hold", () => {
    const walkthrough = prerequisiteWalkthrough(
      { nodes: [guide("arithmetic"), guide("algebra")], edges: [] },
      "algebra",
      {
        nodes: [step("geometry"), step("arithmetic"), step("algebra")],
        edges: [
          prerequisite("geometry", "algebra"),
          prerequisite("arithmetic", "algebra"),
        ],
      }
    );

    expect(levels(walkthrough)).toEqual({ arithmetic: 0, algebra: 1 });
    expect(walkthrough.edges).toEqual([
      { from_id: "arithmetic", to_id: "algebra" },
    ]);
  });

  it("keeps a real prerequisite whose chain to the target lost a card", () => {
    const walkthrough = prerequisiteWalkthrough(
      { nodes: [guide("counting"), guide("algebra")], edges: [] },
      "algebra",
      {
        nodes: [step("counting"), step("arithmetic"), step("algebra")],
        edges: [
          prerequisite("counting", "arithmetic"),
          prerequisite("arithmetic", "algebra"),
        ],
      }
    );

    expect(levels(walkthrough)).toEqual({ counting: 0, algebra: 0 });
  });
});
