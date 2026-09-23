import type { ObjectiveGraphInput } from "@bluelearn/schemas";

import type {
  ObjectiveGraphData,
  ObjectiveGraphEdge,
} from "@/types/contributions";

// d: drawn by the curator, g: the guides' own prerequisites
const DRAWN_EDGE_PREFIX = "d:";
const GUIDE_EDGE_PREFIX = "g:";

export const drawnEdgeId = (source: string, target: string) =>
  `${DRAWN_EDGE_PREFIX}${source}-${target}`;

export const guideEdgeId = (source: string, target: string) =>
  `${GUIDE_EDGE_PREFIX}${source}-${target}`;

export const isDrawnEdge = (edge: ObjectiveGraphEdge) =>
  edge.id.startsWith(DRAWN_EDGE_PREFIX);

export function addGuideNode(
  graph: ObjectiveGraphData,
  guide: { guideBaseId: string; guideSlug: string; title: string }
): ObjectiveGraphData {
  const onCanvas = graph.nodes.some(
    (n) => n.type !== "guide_request" && n.guideBaseId === guide.guideBaseId
  );
  if (onCanvas) return graph;

  return {
    ...graph,
    nodes: [
      ...graph.nodes,
      { id: crypto.randomUUID(), type: "guide", ...guide },
    ],
  };
}

export function addRequestNode(
  graph: ObjectiveGraphData,
  request: { title: string; summary: string }
): ObjectiveGraphData {
  return {
    ...graph,
    nodes: [
      ...graph.nodes,
      { id: crypto.randomUUID(), type: "guide_request", ...request },
    ],
  };
}

// source is the prerequisite
export function connectNodes(
  graph: ObjectiveGraphData,
  sourceId: string,
  targetId: string
): ObjectiveGraphData {
  const nodeIds = new Set(graph.nodes.map((n) => n.id));
  const known = nodeIds.has(sourceId) && nodeIds.has(targetId);
  const duplicate = graph.edges.some(
    (e) => e.source === sourceId && e.target === targetId
  );

  if (sourceId === targetId || !known || duplicate) return graph;
  if (reaches(graph, targetId, sourceId)) return graph;

  return {
    ...graph,
    edges: [
      ...graph.edges,
      {
        id: drawnEdgeId(sourceId, targetId),
        source: sourceId,
        target: targetId,
      },
    ],
  };
}

export function removeNodes(
  graph: ObjectiveGraphData,
  ids: Array<string>
): ObjectiveGraphData {
  const removed = new Set(ids);

  return {
    nodes: graph.nodes.filter((n) => !removed.has(n.id)),
    edges: graph.edges.filter(
      (e) => !removed.has(e.source) && !removed.has(e.target)
    ),
  };
}

export function removeEdges(
  graph: ObjectiveGraphData,
  ids: Array<string>
): ObjectiveGraphData {
  const removed = new Set(ids);

  return {
    ...graph,
    edges: graph.edges.filter((e) => !(isDrawnEdge(e) && removed.has(e.id))),
  };
}

// ponytail: the server keeps its own id for a guide node it already holds
export function graphToApi(graph: ObjectiveGraphData): ObjectiveGraphInput {
  return {
    nodes: graph.nodes.map((n) =>
      n.type === "guide_request"
        ? { id: n.id, title: n.title, summary: n.summary }
        : { id: n.id, guide_base_id: n.guideBaseId }
    ),
    edges: graph.edges
      .filter(isDrawnEdge)
      .map((e) => ({ from_node_id: e.source, to_node_id: e.target })),
  };
}

function reaches(graph: ObjectiveGraphData, fromId: string, toId: string) {
  const seen = new Set([fromId]);
  const pending = [fromId];

  while (pending.length > 0) {
    const current = pending.pop()!;
    if (current === toId) return true;

    for (const edge of graph.edges) {
      if (edge.source !== current || seen.has(edge.target)) continue;
      seen.add(edge.target);
      pending.push(edge.target);
    }
  }

  return false;
}
