import type { ObjectiveGraphData } from "@/types/contributions";
import { targetNodeIds } from "@/lib/objectiveGraphEdits";

type LayoutOptions = {
  nodeWidth: number;
  nodeSpacing: number;
  levelSpacing: number;
};

type NodePosition = {
  id: string;
  position: { x: number; y: number };
};

// Left to right inside a row; a target of either type sorts last.
const KIND_ORDER = {
  guide: 0,
  guide_request: 1,
  target: 2,
};

// Prerequisites below dependents, matching the node handles (in at the bottom,
// out at the top): flip both together. Each connected group of edges is an
// island of its own rows; islands stand side by side, top rows aligned, and
// the whole set centres on x = 0 like useGraphLayout.
export function layoutObjectiveGraph(
  graph: ObjectiveGraphData,
  { nodeWidth, nodeSpacing, levelSpacing }: LayoutOptions
): Array<NodePosition> {
  const levelById = longestPathLevels(graph);
  const islands = connectedIslands(graph);
  const inIsland = new Set(islands.flat());

  // A connected island numbers its rows by rank, so a level nothing landed on
  // leaves no gap.
  const rowSets = islands.map((ids) => {
    const levels = [...new Set(ids.map((id) => levelById.get(id)!))].sort(
      (a, b) => a - b
    );
    const rowByLevel = new Map(levels.map((level, rank) => [level, rank]));
    const rowById = new Map(
      ids.map((id) => [id, rowByLevel.get(levelById.get(id)!)!])
    );
    return { ids, rowById, rowCount: levels.length };
  });

  // A node with no edge leads nowhere, so it is a target: the loose ones share
  // one last island on the top row, level with the deepest island's targets.
  const looseIds = graph.nodes
    .filter((n) => !inIsland.has(n.id))
    .map((n) => n.id);

  if (looseIds.length > 0) {
    const top = Math.max(1, ...rowSets.map((s) => s.rowCount)) - 1;
    const rowById = new Map(looseIds.map((id) => [id, top]));
    rowSets.push({ ids: looseIds, rowById, rowCount: top + 1 });
  }

  // sort is stable, so input order holds within a kind.
  const targets = targetNodeIds(graph);
  const kindOf = (n: ObjectiveGraphData["nodes"][number]) =>
    KIND_ORDER[targets.has(n.id) ? "target" : n.type];
  const byKind = [...graph.nodes].sort((a, b) => kindOf(a) - kindOf(b));

  const blocks = rowSets.map(({ ids, rowById, rowCount }) => {
    const members = new Set(ids);
    const idsByRow = new Map<number, Array<string>>();
    for (const node of byKind) {
      if (!members.has(node.id)) continue;
      const row = rowById.get(node.id)!;
      idsByRow.set(row, [...(idsByRow.get(row) ?? []), node.id]);
    }
    const width =
      Math.max(...[...idsByRow.values()].map((row) => row.length)) *
      nodeSpacing;
    return { idsByRow, rowCount, width };
  });

  // One nodeSpacing between islands, beyond their own widths.
  const totalWidth =
    blocks.reduce((sum, block) => sum + block.width, 0) +
    Math.max(0, blocks.length - 1) * nodeSpacing;
  let blockLeft = -totalWidth / 2;

  return blocks.flatMap(({ idsByRow, rowCount, width }) => {
    const centerX = blockLeft + width / 2;
    blockLeft += width + nodeSpacing;

    return [...idsByRow].flatMap(([row, ids]) => {
      const startX = centerX - (ids.length * nodeSpacing) / 2;

      return ids.map((id, index) => {
        const cellCenterX = startX + index * nodeSpacing + nodeSpacing / 2;

        return {
          id,
          position: {
            x: cellCenterX - nodeWidth / 2,
            y: (rowCount - 1 - row) * levelSpacing,
          },
        };
      });
    });
  });
}

// Connected components of the edges, undirected, over edges whose ends are
// both nodes. Ordered by each island's earliest node in graph.nodes, so an
// edge added inside one island never reorders the others.
function connectedIslands(graph: ObjectiveGraphData): Array<Array<string>> {
  const neighbours = new Map<string, Array<string>>(
    graph.nodes.map((n) => [n.id, []])
  );
  for (const edge of graph.edges) {
    const fromSource = neighbours.get(edge.source);
    const fromTarget = neighbours.get(edge.target);
    if (!fromSource || !fromTarget) continue;
    fromSource.push(edge.target);
    fromTarget.push(edge.source);
  }

  const seen = new Set<string>();
  const islands: Array<Array<string>> = [];
  for (const node of graph.nodes) {
    if (seen.has(node.id) || neighbours.get(node.id)!.length === 0) continue;
    const island: Array<string> = [];
    const queue = [node.id];
    seen.add(node.id);
    while (queue.length > 0) {
      const id = queue.pop()!;
      island.push(id);
      for (const next of neighbours.get(id)!) {
        if (seen.has(next)) continue;
        seen.add(next);
        queue.push(next);
      }
    }
    islands.push(island);
  }
  return islands;
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
