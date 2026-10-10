import type {
  GuideListItem,
  ObjectiveSnapshot,
  Walkthrough,
} from "@bluelearn/schemas";

// Published projected edges already bridge skipped guides. Their endpoints are
// guide-base IDs, not revision-node IDs; the curator's linear order is separate.
export function buildObjectiveGraph(
  snapshot: ObjectiveSnapshot,
  guides: Array<GuideListItem>
): Walkthrough {
  const included = snapshot.nodes.filter((node) => node.is_included);
  const ids = new Set(included.map((node) => node.guide_base_id));
  const edges = snapshot.projected_edges.filter(
    (edge) => ids.has(edge.from_id) && ids.has(edge.to_id)
  );
  const guideBySlug = new Map(guides.map((guide) => [guide.slug, guide]));
  const levels = new Map(included.map((node) => [node.guide_base_id, 0]));
  const remaining = new Map(included.map((node) => [node.guide_base_id, 0]));
  const dependents = new Map<string, Array<string>>();

  for (const edge of edges) {
    remaining.set(edge.to_id, remaining.get(edge.to_id)! + 1);
    const next = dependents.get(edge.from_id) ?? [];
    next.push(edge.to_id);
    dependents.set(edge.from_id, next);
  }

  // Longest prerequisite path keeps every parent above its dependents, even
  // when multiple targets share prerequisites or a guide has several parents.
  const ready = included
    .filter((node) => remaining.get(node.guide_base_id) === 0)
    .map((node) => node.guide_base_id);
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

  return {
    nodes: included.map((node) => {
      const guide = node.slug ? guideBySlug.get(node.slug) : undefined;
      return {
        id: node.guide_base_id,
        // Keep unavailable guides in the graph without inventing a reader URL.
        slug: node.slug ?? node.guide_base_id,
        title: node.title ?? "Untitled guide",
        summary: guide?.summary ?? null,
        level: levels.get(node.guide_base_id)!,
        duration_minutes: guide?.duration_minutes ?? 0,
        tags: guide?.tags ?? [],
      };
    }),
    edges,
  };
}
