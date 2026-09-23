import type { ObjectiveGraphData } from "@/types/contributions";

type LayoutOptions = {
  nodeWidth: number;
  nodeSpacing: number;
  levelSpacing: number;
};

type NodePosition = {
  id: string;
  position: { x: number; y: number };
};

// Prerequisites below dependents, matching the node handles (in at the bottom,
// out at the top): flip both together. Rows centre on x = 0 like useGraphLayout.
export function layoutObjectiveGraph(
  graph: ObjectiveGraphData,
  { nodeWidth, nodeSpacing, levelSpacing }: LayoutOptions
): Array<NodePosition> {
  const levelById = longestPathLevels(graph);

  const lastLevel = Math.max(0, ...levelById.values());
  for (const node of graph.nodes) {
    if (node.type === "target") levelById.set(node.id, lastLevel);
  }

  const idsByLevel = new Map<number, Array<string>>();
  for (const node of graph.nodes) {
    const level = levelById.get(node.id)!;
    idsByLevel.set(level, [...(idsByLevel.get(level) ?? []), node.id]);
  }

  // Rows are numbered by rank, so a level emptied by moving targets to the last
  // level leaves no gap.
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
