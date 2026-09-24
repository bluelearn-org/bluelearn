import type {
  ObjectiveGraphInput,
  ObjectiveSnapshot,
  Walkthrough,
} from "@bluelearn/schemas";

import type {
  ObjectiveContribution,
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

// A target is the end of a sub-objective: a node with no edge out to another
// node. The live rule between saves; the server derives the same and its answer
// wins after each save (adoptSavedSnapshot).
export function targetNodeIds(graph: ObjectiveGraphData): Set<string> {
  const ids = new Set(graph.nodes.map((n) => n.id));
  const leadsOn = new Set(
    graph.edges
      .filter((e) => ids.has(e.source) && ids.has(e.target))
      .map((e) => e.source)
  );

  return new Set(
    graph.nodes.filter((n) => !leadsOn.has(n.id)).map((n) => n.id)
  );
}

// Keeps the curator's order for targets that still hold, appends newcomers in
// canvas order, and clears featured when its node left.
export function withLiveTargets(
  data: ObjectiveContribution,
  graph: ObjectiveGraphData
): ObjectiveContribution {
  const live = targetNodeIds(graph);
  const kept = data.targets.filter((id) => live.has(id));
  const newcomers = graph.nodes
    .map((n) => n.id)
    .filter((id) => live.has(id) && !kept.includes(id));
  const targets = [...kept, ...newcomers];

  return {
    ...data,
    graph,
    targets,
    featuredSubObjective: targets.includes(data.featuredSubObjective)
      ? data.featuredSubObjective
      : "",
  };
}

// Merges a save's answer into the draft without replacing it: positions and
// whatever the curator changed while the save was in flight stay.
export function adoptSavedSnapshot(
  data: ObjectiveContribution,
  snapshot: Pick<ObjectiveSnapshot, "nodes" | "raw_edges">
): ObjectiveContribution {
  // A guide re-added under a fresh id comes back under the id the draft
  // already stored for its base; requests keep the canvas's id.
  const storedIdByBase = new Map(
    snapshot.nodes.flatMap((n) =>
      n.guide_base_id === null ? [] : [[n.guide_base_id, n.id] as const]
    )
  );
  const renamed = new Map(
    data.graph.nodes.flatMap((n) => {
      if (n.type !== "guide") return [];
      const stored = storedIdByBase.get(n.guideBaseId);
      return stored && stored !== n.id ? [[n.id, stored] as const] : [];
    })
  );
  const rekey = (id: string) => renamed.get(id) ?? id;

  const nodes = data.graph.nodes.map((n) => ({ ...n, id: rekey(n.id) }));
  let edges = data.graph.edges.map((e) => {
    const source = rekey(e.source);
    const target = rekey(e.target);
    const id = isDrawnEdge(e)
      ? drawnEdgeId(source, target)
      : guideEdgeId(source, target);
    return { id, source, target };
  });

  // The guides' own prerequisites between guides on the canvas, as addWalkthrough draws them.
  const nodeIdByBase = new Map(
    nodes.flatMap((n) =>
      n.type === "guide" ? [[n.guideBaseId, n.id] as const] : []
    )
  );
  for (const e of snapshot.raw_edges) {
    const source = nodeIdByBase.get(e.from_id);
    const target = nodeIdByBase.get(e.to_id);
    if (!source || !target) continue;
    if (edges.some((edge) => edge.source === source && edge.target === target))
      continue;
    edges = [...edges, { id: guideEdgeId(source, target), source, target }];
  }
  const graph = { nodes, edges };

  // The server's targets in its order; a node it dropped leaves.
  const serverTargets = snapshot.nodes
    .filter((n) => n.is_target)
    .sort(
      (a, b) =>
        (a.target_position ?? Number.POSITIVE_INFINITY) -
        (b.target_position ?? Number.POSITIVE_INFINITY)
    )
    .map((n) => n.id);
  const onCanvas = new Set(nodes.map((n) => n.id));
  const kept = serverTargets.filter((id) => onCanvas.has(id));
  const live = targetNodeIds(graph);
  const newcomers = nodes
    .map((n) => n.id)
    .filter((id) => live.has(id) && !serverTargets.includes(id));
  const targets = [...kept, ...newcomers];

  const featured = rekey(data.featuredSubObjective);
  const serverFeatured = snapshot.nodes.find((n) => n.is_featured)?.id ?? "";
  const featuredSubObjective = targets.includes(featured)
    ? featured
    : targets.includes(serverFeatured)
      ? serverFeatured
      : "";

  return {
    ...data,
    graph,
    targets,
    featuredSubObjective,
    subObjectives: data.subObjectives.map((s) => ({
      targetNodeId: rekey(s.targetNodeId),
      selectedNodeIds: s.selectedNodeIds.map(rekey),
      curatedSequence: s.curatedSequence.map(rekey),
    })),
  };
}

// What a step card shows for a canvas node: its listed guide, or the request
// itself, which has no guide yet.
export function nodeCard<TGuide>(
  graph: ObjectiveGraphData,
  guidesBySlug: Map<string, TGuide>,
  nodeId: string
): TGuide | { title: string; summary: string; tags: [] } | undefined {
  const node = graph.nodes.find((n) => n.id === nodeId);
  if (!node) return undefined;
  if (node.type === "guide_request")
    return { title: node.title, summary: node.summary, tags: [] };

  return (
    guidesBySlug.get(node.guideSlug) ?? {
      title: node.title,
      summary: "",
      tags: [],
    }
  );
}

// A target's drawn prerequisites, walked backward over the canvas edges, as a
// walkthrough keyed by node id: a request target has no guide to fetch one for.
export function prerequisiteWalkthrough(
  graph: ObjectiveGraphData,
  targetId: string
): Walkthrough {
  const reached = new Set([targetId]);
  const pending = [targetId];
  while (pending.length > 0) {
    const current = pending.pop()!;
    for (const e of graph.edges) {
      if (e.target !== current || reached.has(e.source)) continue;
      reached.add(e.source);
      pending.push(e.source);
    }
  }

  const edges = graph.edges.filter(
    (e) => reached.has(e.source) && reached.has(e.target)
  );
  // longest path from a root, so a prerequisite always sits below
  const level = new Map([...reached].map((id) => [id, 0]));
  for (let pass = 0; pass < reached.size; pass++)
    for (const e of edges)
      level.set(
        e.target,
        Math.max(level.get(e.target)!, level.get(e.source)! + 1)
      );

  return {
    nodes: graph.nodes
      .filter((n) => reached.has(n.id))
      .map((n) => ({
        id: n.id,
        slug: n.id,
        title: n.title,
        summary: n.type === "guide_request" ? n.summary : null,
        level: level.get(n.id)!,
        duration_minutes: 0,
        tags: [],
      })),
    edges: edges.map((e) => ({ from_id: e.source, to_id: e.target })),
  };
}

// A fetched guide walkthrough rekeyed onto the canvas's node ids; a guide the
// canvas does not hold cannot be sequenced, so it is left out.
export function walkthroughOnCanvas(
  graph: ObjectiveGraphData,
  walkthrough: Walkthrough
): Walkthrough {
  const nodeIdByBase = new Map(
    graph.nodes.flatMap((n) =>
      n.type === "guide" ? [[n.guideBaseId, n.id] as const] : []
    )
  );

  return {
    nodes: walkthrough.nodes.flatMap((n) => {
      const id = nodeIdByBase.get(n.id);
      return id ? [{ ...n, id, slug: id }] : [];
    }),
    edges: walkthrough.edges.flatMap((e) => {
      const from_id = nodeIdByBase.get(e.from_id);
      const to_id = nodeIdByBase.get(e.to_id);
      return from_id && to_id ? [{ from_id, to_id }] : [];
    }),
  };
}

export function addGuideNode(
  graph: ObjectiveGraphData,
  guide: {
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
    nodes: [
      ...graph.nodes,
      { id: crypto.randomUUID(), type: "guide", ...guide },
    ],
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
