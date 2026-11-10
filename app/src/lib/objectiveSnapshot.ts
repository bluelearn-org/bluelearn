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
      // A stored sequence can already end with the target; it is appended
      // here once, so a repeat would list it twice.
      steps: [
        ...snapshot.orders
          .filter(
            (o) => o.target_node_id === target.id && o.node_id !== target.id
          )
          .sort((a, b) => a.position - b.position)
          .map((o) => nodeById.get(o.node_id))
          .filter((node) => node !== undefined),
        target,
      ],
    }));
}

// Opened from an objective, a guide's URL names it (and the sub-objective) so
// the reader can rebuild the sequence for Prev/Next on any load, shared or not.
// The walkthrough carries it too, so a round trip keeps the position.
export type ObjectiveGuideSearch = {
  objective?: string;
  target?: string;
};

export function parseObjectiveGuideSearch(
  search: Record<string, unknown>
): ObjectiveGuideSearch {
  return {
    objective:
      typeof search.objective === "string" ? search.objective : undefined,
    target: typeof search.target === "string" ? search.target : undefined,
  };
}

// The objective page keeps its view and open sub-objective in the URL, so a
// learner coming back from a guide, by the breadcrumb or the browser, lands
// where they left. The graph is the default view and is left out.
export type ObjectivePageSearch = {
  view?: "linear";
  target?: string;
};

export function parseObjectivePageSearch(
  search: Record<string, unknown>
): ObjectivePageSearch {
  return {
    view: search.view === "linear" ? "linear" : undefined,
    target: typeof search.target === "string" ? search.target : undefined,
  };
}

// The hash that marks a guide's step on the objective page. The router
// scrolls it into view, and the graph opens on it.
export function guideAnchor(slug: string) {
  return `guide-${slug}`;
}

export function guideSlugFromAnchor(hash: string) {
  return hash.startsWith("guide-") ? hash.slice("guide-".length) : undefined;
}

export type GuideNeighbour = { slug: string; title: string };

// The guides either side of a guide in its sub-objective's sequence, the same
// order the linear view lists. Requests have no page, so they are skipped. A
// guide can sit in several sub-objectives; without a target, the first one
// holding it is used.
export function findGuideNeighbours(
  snapshot: Pick<ObjectiveSnapshot, "nodes" | "orders">,
  guideSlug: string,
  targetId?: string
) {
  const subObjectives = buildSubObjectives(snapshot);
  const holdsGuide = (steps: Array<ObjectiveSnapshotNode>) =>
    steps.some((node) => node.slug === guideSlug);

  const subObjective =
    subObjectives.find(
      ({ target, steps }) => target.id === targetId && holdsGuide(steps)
    ) ?? subObjectives.find(({ steps }) => holdsGuide(steps));
  if (!subObjective) return null;

  const openable: Array<GuideNeighbour> = subObjective.steps.flatMap((node) =>
    node.guide_base_id !== null && node.slug !== null
      ? [{ slug: node.slug, title: nodeLabel(node) }]
      : []
  );
  const index = openable.findIndex((guide) => guide.slug === guideSlug);
  if (index === -1) return null;

  return {
    targetId: subObjective.target.id,
    prev: index > 0 ? openable[index - 1] : null,
    next: index < openable.length - 1 ? openable[index + 1] : null,
  };
}

export function buildObjectiveFlow(
  snapshot: Pick<ObjectiveSnapshot, "nodes" | "orders">,
  guides: Array<GuideListItem>
) {
  const guideBySlug = new Map(guides.map((g) => [g.slug, g]));

  const targets = buildSubObjectives(snapshot).map(({ target, steps }) => ({
    id: target.id,
    slug: target.slug ?? target.id,
    title: target.title ?? "Untitled guide",
    summary: null,
    guides: steps.map((node) => {
      const guide = node.slug ? guideBySlug.get(node.slug) : undefined;

      return {
        guide: {
          id: node.id,
          slug: node.slug,
          isRequest: node.guide_base_id === null,
          title: node.title ?? "Untitled guide",
          author: guide?.author,
          summary: node.summary ?? guide?.summary,
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
