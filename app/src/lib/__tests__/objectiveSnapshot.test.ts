import { describe, expect, it } from "vitest";

import type {
  ObjectiveSnapshot,
  ObjectiveSnapshotNode,
} from "@bluelearn/schemas";
import {
  buildSubObjectives,
  findGuideNeighbours,
  guideAnchor,
  guideSlugFromAnchor,
  parseObjectiveGuideSearch,
  parseObjectivePageSearch,
} from "@/lib/objectiveSnapshot";

const guideNode = (
  id: string,
  fields: Partial<ObjectiveSnapshotNode> = {}
): ObjectiveSnapshotNode => ({
  id,
  guide_base_id: `base-${id}`,
  guide_id: null,
  slug: id,
  title: `Guide ${id}`,
  summary: null,
  request_id: null,
  is_target: false,
  is_included: true,
  is_featured: false,
  target_position: null,
  note: null,
  ...fields,
});

const requestNode = (id: string): ObjectiveSnapshotNode =>
  guideNode(id, { guide_base_id: null, slug: null, title: `Request ${id}` });

const target = (id: string, position: number) =>
  guideNode(id, { is_target: true, target_position: position });

const order = (targetId: string, nodeId: string, position: number) => ({
  target_node_id: targetId,
  node_id: nodeId,
  position,
});

const snapshotOf = (
  nodes: Array<ObjectiveSnapshotNode>,
  orders: ObjectiveSnapshot["orders"]
) => ({ nodes, orders });

const slugs = (neighbours: ReturnType<typeof findGuideNeighbours>) =>
  neighbours && {
    prev: neighbours.prev?.slug ?? null,
    next: neighbours.next?.slug ?? null,
  };

describe("parseObjectiveGuideSearch", () => {
  it("keeps the objective and target when both are strings", () => {
    expect(
      parseObjectiveGuideSearch({ objective: "games", target: "ship" })
    ).toEqual({ objective: "games", target: "ship" });
  });

  it("drops values that are missing or not strings", () => {
    expect(parseObjectiveGuideSearch({})).toEqual({
      objective: undefined,
      target: undefined,
    });
    expect(parseObjectiveGuideSearch({ objective: 3, target: ["a"] })).toEqual({
      objective: undefined,
      target: undefined,
    });
  });
});

describe("buildSubObjectives", () => {
  it("lists the target once when the stored sequence already ends with it", () => {
    const [{ steps }] = buildSubObjectives(
      snapshotOf(
        [guideNode("intro"), target("ship", 0)],
        [order("ship", "intro", 0), order("ship", "ship", 1)]
      )
    );

    expect(steps.map((node) => node.id)).toEqual(["intro", "ship"]);
  });
});

describe("parseObjectivePageSearch", () => {
  it("keeps the linear view and the target", () => {
    expect(
      parseObjectivePageSearch({ view: "linear", target: "ship" })
    ).toEqual({ view: "linear", target: "ship" });
  });

  it("leaves the graph, the default, out", () => {
    expect(parseObjectivePageSearch({ view: "graph" })).toEqual({
      view: undefined,
      target: undefined,
    });
  });

  it("drops values that are missing or malformed", () => {
    expect(parseObjectivePageSearch({ view: 1, target: ["a"] })).toEqual({
      view: undefined,
      target: undefined,
    });
  });
});

describe("guide anchors", () => {
  it("round-trips a guide slug", () => {
    expect(guideAnchor("loops")).toBe("guide-loops");
    expect(guideSlugFromAnchor(guideAnchor("loops"))).toBe("loops");
  });

  it("ignores a hash that names no guide", () => {
    expect(guideSlugFromAnchor("")).toBeUndefined();
    expect(guideSlugFromAnchor("overview")).toBeUndefined();
  });
});

describe("findGuideNeighbours", () => {
  // intro -> setup -> sprites, then the target ship.
  const linear = snapshotOf(
    [
      guideNode("intro"),
      guideNode("setup"),
      guideNode("sprites"),
      target("ship", 0),
    ],
    [
      order("ship", "intro", 0),
      order("ship", "setup", 1),
      order("ship", "sprites", 2),
    ]
  );

  it("follows the sequence order, ending on the target", () => {
    expect(slugs(findGuideNeighbours(linear, "setup"))).toEqual({
      prev: "intro",
      next: "sprites",
    });
    expect(slugs(findGuideNeighbours(linear, "sprites"))).toEqual({
      prev: "setup",
      next: "ship",
    });
  });

  it("offers no Prev on the first guide and no Next on the last", () => {
    expect(slugs(findGuideNeighbours(linear, "intro"))).toEqual({
      prev: null,
      next: "setup",
    });
    expect(slugs(findGuideNeighbours(linear, "ship"))).toEqual({
      prev: "sprites",
      next: null,
    });
  });

  it("names each neighbour by its title", () => {
    expect(findGuideNeighbours(linear, "setup")?.next).toEqual({
      slug: "sprites",
      title: "Guide sprites",
    });
  });

  it("returns the sub-objective it used", () => {
    expect(findGuideNeighbours(linear, "setup")?.targetId).toBe("ship");
  });

  it("offers no Next on the target when the stored sequence already ends with it", () => {
    const repeated = snapshotOf(linear.nodes, [
      ...linear.orders,
      order("ship", "ship", 3),
    ]);

    expect(slugs(findGuideNeighbours(repeated, "ship"))).toEqual({
      prev: "sprites",
      next: null,
    });
  });

  it("steps over requests, which have no page to open", () => {
    const withRequest = snapshotOf(
      [
        guideNode("intro"),
        requestNode("wish"),
        guideNode("setup"),
        target("ship", 0),
      ],
      [
        order("ship", "intro", 0),
        order("ship", "wish", 1),
        order("ship", "setup", 2),
      ]
    );

    expect(slugs(findGuideNeighbours(withRequest, "intro"))).toEqual({
      prev: null,
      next: "setup",
    });
    expect(slugs(findGuideNeighbours(withRequest, "setup"))).toEqual({
      prev: "intro",
      next: "ship",
    });
  });

  describe("a guide shared by two sub-objectives", () => {
    // basics leads into both tools and survey, with different neighbours.
    const shared = snapshotOf(
      [
        guideNode("basics"),
        guideNode("maps"),
        target("tools", 0),
        target("survey", 1),
      ],
      [
        order("tools", "basics", 0),
        order("survey", "maps", 0),
        order("survey", "basics", 1),
      ]
    );

    it("uses the named sub-objective", () => {
      const neighbours = findGuideNeighbours(shared, "basics", "survey");

      expect(neighbours?.targetId).toBe("survey");
      expect(slugs(neighbours)).toEqual({ prev: "maps", next: "survey" });
    });

    it("falls back to the first sub-objective without a target", () => {
      const neighbours = findGuideNeighbours(shared, "basics");

      expect(neighbours?.targetId).toBe("tools");
      expect(slugs(neighbours)).toEqual({ prev: null, next: "tools" });
    });

    it("falls back to the first sub-objective when the named one lacks the guide", () => {
      expect(findGuideNeighbours(shared, "maps", "tools")?.targetId).toBe(
        "survey"
      );
    });
  });

  it("returns null for a guide outside the objective", () => {
    expect(findGuideNeighbours(linear, "elsewhere")).toBeNull();
  });
});
