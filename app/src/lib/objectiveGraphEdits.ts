import type { ObjectiveGraphInput, Walkthrough } from "@bluelearn/schemas";

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
  guide: {
    type: "guide" | "target";
    guideBaseId: string;
    guideSlug: string;
    title: string;
  }
): ObjectiveGraphData {
  const onCanvas = graph.nodes.some(
    (n) => n.type !== "guide_request" && n.guideBaseId === guide.guideBaseId
  );
  if (onCanvas) return graph;

  return {
    ...graph,
    nodes: [...graph.nodes, { id: crypto.randomUUID(), ...guide }],
  };
}

export function addWalkthrough(
  graph: ObjectiveGraphData,
  walkthrough: Walkthrough
): {
  graph: ObjectiveGraphData;
  removedDrawnEdges: Array<ObjectiveGraphEdge>;
} {
  const placed = walkthrough.nodes.reduce(
    (next, n) =>
      addGuideNode(next, {
        type: "guide",
        guideBaseId: n.id,
        guideSlug: n.slug,
        title: n.title,
      }),
    graph
  );

  const nodeIdByBaseId = new Map(
    placed.nodes.flatMap((n) =>
      n.type === "guide_request" ? [] : [[n.guideBaseId, n.id] as const]
    )
  );

  let edges = placed.edges;
  const removedDrawnEdges: Array<ObjectiveGraphEdge> = [];

  for (const e of walkthrough.edges) {
    const source = nodeIdByBaseId.get(e.from_id);
    const target = nodeIdByBaseId.get(e.to_id);
    if (!source || !target) continue;

    const id = guideEdgeId(source, target);
    const drawnId = drawnEdgeId(source, target);
    if (edges.some((edge) => edge.id === id || edge.id === drawnId)) continue;

    // the guide's arrow wins: publish would 409 on the cycle a drawn edge closes
    let cycle = reaches({ ...placed, edges }, target, source);
    while (cycle) {
      const drawnOnCycle = cycle.filter(isDrawnEdge);
      if (drawnOnCycle.length === 0) break;

      removedDrawnEdges.push(...drawnOnCycle);
      edges = edges.filter((edge) => !drawnOnCycle.includes(edge));
      cycle = reaches({ ...placed, edges }, target, source);
    }
    if (cycle) continue;

    edges = [...edges, { id, source, target }];
  }

  return { graph: { ...placed, edges }, removedDrawnEdges };
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

// source is the prerequisite. The drawn edge wins over any path back from
// target to source, imported prerequisites included.
export function connectNodes(
  graph: ObjectiveGraphData,
  sourceId: string,
  targetId: string
): ObjectiveGraphData {
  if (!canConnect(graph, sourceId, targetId)) return graph;

  const cut = edgesCutByConnecting(graph, sourceId, targetId);

  return {
    ...graph,
    edges: [
      ...graph.edges.filter((e) => !cut.includes(e)),
      {
        id: drawnEdgeId(sourceId, targetId),
        source: sourceId,
        target: targetId,
      },
    ],
  };
}

// Every edge on some path from target back to source; empty when connecting
// closes no cycle or connectNodes would refuse the pair.
export function edgesCutByConnecting(
  graph: ObjectiveGraphData,
  sourceId: string,
  targetId: string
): Array<ObjectiveGraphEdge> {
  if (!canConnect(graph, sourceId, targetId)) return [];

  const afterTarget = reachable(graph.edges, targetId, "downstream");
  const beforeSource = reachable(graph.edges, sourceId, "upstream");

  return graph.edges.filter(
    (e) => afterTarget.has(e.source) && beforeSource.has(e.target)
  );
}

function canConnect(
  graph: ObjectiveGraphData,
  sourceId: string,
  targetId: string
) {
  const nodeIds = new Set(graph.nodes.map((n) => n.id));
  const known = nodeIds.has(sourceId) && nodeIds.has(targetId);
  const duplicate = graph.edges.some(
    (e) => e.source === sourceId && e.target === targetId
  );

  return sourceId !== targetId && known && !duplicate;
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

function reaches(
  graph: ObjectiveGraphData,
  fromId: string,
  toId: string
): Array<ObjectiveGraphEdge> | null {
  const arrivedBy = new Map<string, ObjectiveGraphEdge>();
  const seen = new Set([fromId]);
  const pending = [fromId];

  while (pending.length > 0) {
    const current = pending.pop()!;
    if (current === toId) {
      const path: Array<ObjectiveGraphEdge> = [];
      for (let e = arrivedBy.get(toId); e; e = arrivedBy.get(e.source))
        path.unshift(e);
      return path;
    }

    for (const edge of graph.edges) {
      if (edge.source !== current || seen.has(edge.target)) continue;
      seen.add(edge.target);
      arrivedBy.set(edge.target, edge);
      pending.push(edge.target);
    }
  }

  return null;
}

function reachable(
  edges: Array<ObjectiveGraphEdge>,
  startId: string,
  direction: "upstream" | "downstream"
): Set<string> {
  const seen = new Set([startId]);
  const pending = [startId];

  while (pending.length > 0) {
    const current = pending.pop()!;

    for (const edge of edges) {
      const [from, to] =
        direction === "downstream"
          ? [edge.source, edge.target]
          : [edge.target, edge.source];
      if (from !== current || seen.has(to)) continue;
      seen.add(to);
      pending.push(to);
    }
  }

  return seen;
}
