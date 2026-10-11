import type {
  GuideListItem,
  ObjectiveSnapshot,
  Walkthrough,
} from "@bluelearn/schemas";
import { nodeLabel } from "@/lib/objectiveSnapshot";

type GraphEdge = Walkthrough["edges"][number];

// What the reader needs beyond what the shared walkthrough renderer draws.
// guideSlug stays null for a request, and for a guide whose base has no slug,
// so neither ever gets an Open Guide link.
type ReaderNode = {
  guideSlug: string | null;
  isRequest: boolean;
  isTarget: boolean;
};

// The walkthrough renderer keys xyflow nodes by slug, so every node goes in
// under its revision node id: requests have no guide base or slug to tell them
// apart. Publishing freezes the projection into drawn_edges beside the
// curator's own edges (publish_objective_revision), and only those rows reach
// request nodes, so projected_edges is never read here.
export function buildObjectiveGraph(
  snapshot: Pick<ObjectiveSnapshot, "nodes" | "drawn_edges">,
  guides: Array<GuideListItem>
) {
  const included = snapshot.nodes.filter((node) => node.is_included);
  const edges = bridgeSkippedNodes(snapshot);
  const levels = prerequisiteDepths(
    included.map((node) => node.id),
    edges
  );

  const guideBySlug = new Map(guides.map((guide) => [guide.slug, guide]));
  const nodes = new Map<string, ReaderNode>();

  const walkthroughNodes = included.map((node) => {
    const isRequest = node.guide_base_id === null;
    const guide = node.slug ? guideBySlug.get(node.slug) : undefined;

    nodes.set(node.id, {
      guideSlug: isRequest ? null : node.slug,
      isRequest,
      isTarget: node.is_target,
    });

    return {
      id: node.id,
      slug: node.id,
      title: nodeLabel(node),
      summary: isRequest ? node.summary : (guide?.summary ?? null),
      level: levels.get(node.id)!,
      duration_minutes: guide?.duration_minutes ?? 0,
      tags: guide?.tags ?? [],
    };
  });

  return {
    walkthrough: { nodes: walkthroughNodes, edges },
    nodes,
    defaultId: firstTarget(included)?.id ?? included.at(0)?.id ?? null,
  };
}

// The reader opens where the curator pointed: the featured target, otherwise
// the first target in the curator's order, the same order the linear view uses.
function firstTarget(included: ObjectiveSnapshot["nodes"]) {
  const position = (node: ObjectiveSnapshot["nodes"][number]) =>
    node.target_position ?? Number.POSITIVE_INFINITY;

  return included
    .filter((node) => node.is_target)
    .sort(
      (a, b) =>
        Number(b.is_featured) - Number(a.is_featured) ||
        position(a) - position(b)
    )
    .at(0);
}

// A skipped node leaves the reader's graph, but what it depended on still leads
// to what depended on it, the same bridge the projection builds over guides
// missing from the revision.
function bridgeSkippedNodes(
  snapshot: Pick<ObjectiveSnapshot, "nodes" | "drawn_edges">
): Array<GraphEdge> {
  const includedIds = new Set(
    snapshot.nodes.filter((node) => node.is_included).map((node) => node.id)
  );
  const prerequisites = new Map<string, Array<string>>();

  for (const edge of snapshot.drawn_edges) {
    const list = prerequisites.get(edge.to_node_id) ?? [];
    list.push(edge.from_node_id);
    prerequisites.set(edge.to_node_id, list);
  }

  const edges: Array<GraphEdge> = [];

  for (const anchor of includedIds) {
    const reached = new Set<string>([anchor]);
    const pending = [...(prerequisites.get(anchor) ?? [])];

    while (pending.length > 0) {
      const id = pending.pop()!;

      if (reached.has(id)) continue;
      reached.add(id);

      if (includedIds.has(id)) {
        edges.push({ from_id: id, to_id: anchor });
      } else {
        pending.push(...(prerequisites.get(id) ?? []));
      }
    }
  }

  return edges;
}

// Longest prerequisite path keeps every parent below its dependents, even when
// several targets share prerequisites or a node has several parents.
function prerequisiteDepths(ids: Array<string>, edges: Array<GraphEdge>) {
  const levels = new Map(ids.map((id) => [id, 0]));
  const remaining = new Map(ids.map((id) => [id, 0]));
  const dependents = new Map<string, Array<string>>();

  for (const edge of edges) {
    remaining.set(edge.to_id, remaining.get(edge.to_id)! + 1);

    const list = dependents.get(edge.from_id) ?? [];
    list.push(edge.to_id);
    dependents.set(edge.from_id, list);
  }

  const ready = ids.filter((id) => remaining.get(id) === 0);

  for (const id of ready) {
    for (const dependent of dependents.get(id) ?? []) {
      levels.set(
        dependent,
        Math.max(levels.get(dependent)!, levels.get(id)! + 1)
      );

      const count = remaining.get(dependent)! - 1;
      remaining.set(dependent, count);
      if (count === 0) ready.push(dependent);
    }
  }

  return levels;
}
