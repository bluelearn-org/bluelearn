import type {
  ObjectiveGraphData,
  ObjectiveGraphNode,
} from "@/types/contributions";

type LayoutOptions = {
  nodeWidth: number;
  nodeSpacing: number;
  levelSpacing: number;
};

type NodePosition = {
  id: string;
  position: { x: number; y: number };
};

// Left to right inside a row.
const KIND_ORDER: Record<ObjectiveGraphNode["type"], number> = {
  guide: 0,
  guide_request: 1,
  target: 2,
};

// Prerequisites below dependents, matching the node handles (in at the bottom,
// out at the top): flip both together. Rows centre on x = 0 like useGraphLayout.
export function layoutObjectiveGraph(
  graph: ObjectiveGraphData,
  { nodeWidth, nodeSpacing, levelSpacing }: LayoutOptions
): Array<NodePosition> {
  const levelById = longestPathLevels(graph);

  // Edges alone place a node. One with none falls back by kind: an existing
  // guide to the bottom row, a target to the top, a request just below it.
  const connected = new Set(
    graph.edges
      .filter((e) => levelById.has(e.source) && levelById.has(e.target))
      .flatMap((e) => [e.source, e.target])
  );
  const loose = (type: ObjectiveGraphNode["type"]) =>
    graph.nodes.filter((n) => n.type === type && !connected.has(n.id));
  const looseRequests = loose("guide_request");
  const looseTargets = loose("target");

  const deepest = Math.max(
    0,
    ...[...connected].map((id) => levelById.get(id)!)
  );
  const fallbackRows = [loose("guide"), looseRequests, looseTargets].filter(
    (nodes) => nodes.length > 0
  ).length;
  const top = Math.max(deepest, fallbackRows - 1);
  const topTaken =
    looseTargets.length > 0 ||
    [...connected].some((id) => levelById.get(id) === top);

  for (const node of looseTargets) levelById.set(node.id, top);
  for (const node of looseRequests)
    levelById.set(node.id, topTaken ? top - 1 : top);

  // sort is stable, so input order holds within a kind.
  const byKind = [...graph.nodes].sort(
    (a, b) => KIND_ORDER[a.type] - KIND_ORDER[b.type]
  );
  const idsByLevel = new Map<number, Array<string>>();
  for (const node of byKind) {
    const level = levelById.get(node.id)!;
    idsByLevel.set(level, [...(idsByLevel.get(level) ?? []), node.id]);
  }

  // Rows are numbered by rank, so a level nothing landed on leaves no gap.
  const levels = [...idsByLevel.keys()].sort((a, b) => a - b);

  return levels.flatMap((level, row) => {
    const ids = idsByLevel.get(level)!;
    const startX = -(ids.length * nodeSpacing) / 2;

    return ids.map((id, index) => {
      const cellCenterX = startX + index * nodeSpacing + nodeSpacing / 2;

      return {
        id,
        position: {
          x: cellCenterX - nodeWidth / 2,
          y: (levels.length - 1 - row) * levelSpacing,
        },
      };
    });
  });
}

function longestPathLevels(graph: ObjectiveGraphData) {
  const levelById = new Map(graph.nodes.map((n) => [n.id, 0]));

  // ponytail: a cycle lands on wrong rows, never errors; upgrade when one can reach the canvas
  for (let pass = 0; pass < graph.nodes.length; pass++) {
    let changed = false;

    for (const edge of graph.edges) {
      const sourceLevel = levelById.get(edge.source);
      const targetLevel = levelById.get(edge.target);
      if (sourceLevel === undefined || targetLevel === undefined) continue;

      if (targetLevel < sourceLevel + 1) {
        levelById.set(edge.target, sourceLevel + 1);
        changed = true;
      }
    }

    if (!changed) break;
  }

  return levelById;
}
