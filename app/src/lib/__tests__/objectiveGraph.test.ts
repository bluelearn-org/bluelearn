import { describe, expect, it } from "vitest";

import type { GuideListItem, ObjectiveSnapshotNode } from "@bluelearn/schemas";
import { buildObjectiveGraph } from "@/lib/objectiveGraph";

const guideNode = (
  id: string,
  fields: Partial<ObjectiveSnapshotNode> = {}
): ObjectiveSnapshotNode => ({
  id,
  guide_base_id: `base-${id}`,
  guide_id: null,
  slug: `slug-${id}`,
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

const requestNode = (
  id: string,
  fields: Partial<ObjectiveSnapshotNode> = {}
): ObjectiveSnapshotNode =>
  guideNode(id, {
    guide_base_id: null,
    slug: null,
    title: `Request ${id}`,
    summary: `Why ${id} is needed`,
    ...fields,
  });

const drawn = (from: string, to: string) => ({
  from_node_id: from,
  to_node_id: to,
});

const listItem = (slug: string, summary: string): GuideListItem => ({
  id: "00000000-0000-4000-8000-000000000001",
  slug,
  title: slug,
  knowledge_type: "theoretical",
  summary,
  status: "published",
  created_at: "2026-10-10T00:00:00.000Z",
  author: null,
  duration_minutes: 12,
  tags: [],
  is_official: false,
});

const edgeKeys = (edges: Array<{ from_id: string; to_id: string }>) =>
  edges.map((edge) => `${edge.from_id}->${edge.to_id}`).sort();

describe("buildObjectiveGraph", () => {
  it("keeps two requests apart, titled from the snapshot, and connected", () => {
    const { walkthrough, nodes } = buildObjectiveGraph(
      {
        nodes: [requestNode("r1"), requestNode("r2", { is_target: true })],
        drawn_edges: [drawn("r1", "r2")],
      },
      []
    );

    expect(walkthrough.nodes.map((node) => node.slug).sort()).toEqual([
      "r1",
      "r2",
    ]);
    expect(walkthrough.nodes.map((node) => node.title).sort()).toEqual([
      "Request r1",
      "Request r2",
    ]);
    expect(walkthrough.nodes.find((node) => node.id === "r1")?.summary).toBe(
      "Why r1 is needed"
    );
    expect(edgeKeys(walkthrough.edges)).toEqual(["r1->r2"]);
    expect(nodes.get("r2")).toEqual({
      guideSlug: null,
      isRequest: true,
      isTarget: true,
    });
  });

  it("never gives a request a guide to open, but gives a guide its slug", () => {
    const { nodes } = buildObjectiveGraph(
      {
        nodes: [
          requestNode("r", { slug: "looks-like-a-guide" }),
          guideNode("g", { is_target: true }),
          guideNode("unslugged", { slug: null }),
        ],
        drawn_edges: [drawn("r", "g"), drawn("unslugged", "g")],
      },
      []
    );

    expect(nodes.get("r")?.guideSlug).toBeNull();
    expect(nodes.get("unslugged")?.guideSlug).toBeNull();
    expect(nodes.get("g")).toEqual({
      guideSlug: "slug-g",
      isRequest: false,
      isTarget: true,
    });
  });

  it("bridges a skipped prerequisite and leaves it out of the graph", () => {
    const { walkthrough } = buildObjectiveGraph(
      {
        nodes: [
          guideNode("a"),
          guideNode("skipped", { is_included: false }),
          requestNode("skipped-request", { is_included: false }),
          guideNode("t", { is_target: true }),
        ],
        drawn_edges: [
          drawn("a", "skipped"),
          drawn("skipped", "skipped-request"),
          drawn("skipped-request", "t"),
        ],
      },
      []
    );

    expect(walkthrough.nodes.map((node) => node.id).sort()).toEqual(["a", "t"]);
    expect(edgeKeys(walkthrough.edges)).toEqual(["a->t"]);
  });

  it("does not bridge through an included node or repeat an edge", () => {
    const { walkthrough } = buildObjectiveGraph(
      {
        nodes: [guideNode("a"), guideNode("b"), guideNode("t")],
        drawn_edges: [drawn("a", "b"), drawn("b", "t"), drawn("b", "t")],
      },
      []
    );

    expect(edgeKeys(walkthrough.edges)).toEqual(["a->b", "b->t"]);
  });

  it("mixes guides and requests and puts a shared prerequisite below both targets", () => {
    const { walkthrough } = buildObjectiveGraph(
      {
        nodes: [
          guideNode("shared"),
          requestNode("mid"),
          guideNode("t1", { is_target: true }),
          requestNode("t2", { is_target: true }),
        ],
        drawn_edges: [
          drawn("shared", "mid"),
          drawn("mid", "t1"),
          drawn("shared", "t2"),
        ],
      },
      [listItem("slug-shared", "Published summary")]
    );

    const level = (id: string) =>
      walkthrough.nodes.find((node) => node.id === id)!.level;

    expect(level("shared")).toBe(0);
    expect(level("mid")).toBe(1);
    expect(level("t1")).toBe(2);
    expect(level("t2")).toBe(1);

    const shared = walkthrough.nodes.find((node) => node.id === "shared")!;
    expect(shared.summary).toBe("Published summary");
    expect(shared.duration_minutes).toBe(12);
  });

  it("opens on the featured target, then on the first target in order", () => {
    const later = guideNode("later", { is_target: true, target_position: 2 });
    const first = requestNode("first", { is_target: true, target_position: 0 });
    const featured = guideNode("featured", {
      is_target: true,
      is_featured: true,
      target_position: 5,
    });

    const open = (nodes: Array<ObjectiveSnapshotNode>) =>
      buildObjectiveGraph({ nodes, drawn_edges: [] }, []).defaultId;

    expect(open([later, first])).toBe("first");
    expect(open([first, later])).toBe("first");
    expect(open([later, first, featured])).toBe("featured");
    expect(open([guideNode("plain"), requestNode("other")])).toBe("plain");
    expect(open([])).toBeNull();
  });
});
