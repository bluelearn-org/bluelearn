import type {
  GuideListItem,
  ObjectiveSnapshot,
  ObjectiveSnapshotNode,
} from "@bluelearn/schemas";
import type { ObjectiveContribution } from "@/types/contributions";
import { formatDate, formatDuration } from "@/lib/guideUtils";

export function nodeLabel(
  node: Pick<ObjectiveSnapshotNode, "guide_base_id" | "slug" | "title">
) {
  return node.title ?? node.slug ?? node.guide_base_id?.slice(0, 8) ?? "";
}

export function stepLabel(node: ObjectiveSnapshotNode) {
  return node.is_included ? nodeLabel(node) : `${nodeLabel(node)} (skipped)`;
}

export function buildSubObjectives(
  snapshot: Pick<ObjectiveSnapshot, "nodes" | "orders">
) {
  const nodeById = new Map(snapshot.nodes.map((n) => [n.id, n]));

  return snapshot.nodes
    .filter((n) => n.is_target)
    .sort((a, b) => (a.target_position ?? 0) - (b.target_position ?? 0))
    .map((target) => ({
      target,
      steps: [
        ...snapshot.orders
          .filter((o) => o.target_node_id === target.id)
          .sort((a, b) => a.position - b.position)
          .map((o) => nodeById.get(o.node_id))
          .filter((node) => node !== undefined),
        target,
      ],
    }));
}

export function buildObjectiveFlow(
  snapshot: Pick<ObjectiveSnapshot, "nodes" | "orders">,
  guides: Array<GuideListItem>
) {
  const guideBySlug = new Map(guides.map((g) => [g.slug, g]));

  const targets = buildSubObjectives(snapshot).map(({ target, steps }) => ({
    slug: target.slug ?? target.id,
    title: target.title ?? "Untitled guide",
    summary: null,
    guides: steps.map((node) => {
      const guide = node.slug ? guideBySlug.get(node.slug) : undefined;
      return {
        guide: {
          slug: node.slug ?? "",
          title: node.title ?? "Untitled guide",
          author: guide?.author,
          summary: guide?.summary,
          created_at: guide
            ? formatDate(new Date(guide.created_at))
            : undefined,
          tags: guide?.tags,
          duration: formatDuration(guide?.duration_minutes ?? 0),
        },
      };
    }),
  }));

  return { targets };
}

export function buildDraftObjectiveSnapshot(
  objective: ObjectiveContribution
): ObjectiveSnapshot {
  const targets = new Set(objective.targets);
  const onCanvas = new Set(objective.graph.nodes.map((node) => node.id));

  const subObjectives = objective.subObjectives.filter((sub) =>
    targets.has(sub.targetNodeId)
  );
  const included = new Set([
    ...targets,
    ...subObjectives.flatMap((sub) => sub.curatedSequence),
  ]);
  const featured = objective.featuredSubObjective || objective.targets[0];

  return {
    nodes: objective.graph.nodes.map((node) => ({
      id: node.id,
      guide_base_id: node.type === "guide" ? node.guideBaseId : null,
      guide_id: null,
      slug: node.type === "guide" ? node.guideSlug : null,
      title: node.title,
      summary: node.type === "guide_request" ? node.summary : null,
      request_id: null,

      is_target: targets.has(node.id),
      is_included: subObjectives.length === 0 || included.has(node.id),
      is_featured: node.id === featured,
      target_position: targets.has(node.id)
        ? objective.targets.indexOf(node.id)
        : null,
      note: null,
    })),

    orders: subObjectives.flatMap((sub) =>
      sub.curatedSequence
        .filter((id) => onCanvas.has(id) && id !== sub.targetNodeId)
        .map((id, position) => ({
          target_node_id: sub.targetNodeId,
          node_id: id,
          position,
        }))
    ),

    projected_edges: [],
    raw_edges: [],
    drawn_edges: objective.graph.edges.map((edge) => ({
      from_node_id: edge.source,
      to_node_id: edge.target,
    })),
  };
}
