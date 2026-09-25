import type {
  GuideListItem,
  ObjectiveSnapshot,
  ObjectiveSnapshotNode,
} from "@bluelearn/schemas";
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
