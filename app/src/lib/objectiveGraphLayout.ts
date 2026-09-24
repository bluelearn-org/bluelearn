import type {
  ObjectiveGraphData,
  ObjectiveGraphNode,
} from "@/types/contributions";

type LayoutOptions = {
  nodeWidth: number;
  nodeSpacing: number;
  bandSpacing: number;
};

type NodePosition = {
  id: string;
  position: { x: number; y: number };
};

// Walkthroughs read bottom to top, matching the node handles (in at the bottom,
// out at the top): flip both together.
const BANDS_BOTTOM_UP: Array<ObjectiveGraphNode["type"]> = [
  "guide",
  "target",
  "guide_request",
];

// One row per kind, centred on x = 0 like useGraphLayout. Inside a row,
// prerequisites sit left of what they lead to.
export function layoutObjectiveGraph(
  graph: ObjectiveGraphData,
  { nodeWidth, nodeSpacing, bandSpacing }: LayoutOptions
): Array<NodePosition> {
  const depthById = longestPathLevels(graph);

  // An empty band leaves no gap.
  const bands = BANDS_BOTTOM_UP.map((type) =>
    graph.nodes
      .filter((node) => node.type === type)
      .sort((a, b) => depthById.get(a.id)! - depthById.get(b.id)!)
      .map((node) => node.id)
  ).filter((ids) => ids.length > 0);

  return bands.flatMap((ids, band) => {
    const startX = -(ids.length * nodeSpacing) / 2;

    return ids.map((id, index) => {
      const cellCenterX = startX + index * nodeSpacing + nodeSpacing / 2;

      return {
        id,
        position: {
          x: cellCenterX - nodeWidth / 2,
          y: (bands.length - 1 - band) * bandSpacing,
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
