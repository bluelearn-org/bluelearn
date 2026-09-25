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

// The server derives targets by the same rule on save; this keeps the canvas
// live between saves.
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

// Merge, not replace: the curator may keep editing while a save is in flight.
export function adoptSavedSnapshot(
  data: ObjectiveContribution,
  snapshot: Pick<ObjectiveSnapshot, "nodes" | "raw_edges">
): ObjectiveContribution {
  // The server keeps the stored id of a guide that was deleted and re-added.
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

  // Published prerequisites between these guides, which the canvas never saw.
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

// Step 5's list for one target. A guide the canvas doesn't hold can't be
// ordered, so it stays out.
export function prerequisiteWalkthrough(
  graph: ObjectiveGraphData,
  targetId: string,
  walkthrough?: Walkthrough
): Walkthrough {
  const nodeIdByBase = new Map(
    graph.nodes.flatMap((n) =>
      n.type === "guide" ? [[n.guideBaseId, n.id] as const] : []
    )
  );
  const fetchedById = new Map(
    (walkthrough?.nodes ?? []).flatMap((n) => {
      const id = nodeIdByBase.get(n.id);
      return id ? [[id, n] as const] : [];
    })
  );

  const merged = new Map<string, { from_id: string; to_id: string }>();
  const merge = (from_id: string, to_id: string) =>
    merged.set(`${from_id}->${to_id}`, { from_id, to_id });
  for (const e of graph.edges) merge(e.source, e.target);
  for (const e of walkthrough?.edges ?? []) {
    const from_id = nodeIdByBase.get(e.from_id);
    const to_id = nodeIdByBase.get(e.to_id);
    if (from_id && to_id) merge(from_id, to_id);
  }

  // A walkthrough is already the target's whole closure: keep its guides even
  // when a card between them was deleted.
  const reached = new Set([targetId, ...fetchedById.keys()]);
  const pending = [...reached];
  while (pending.length > 0) {
    const current = pending.pop()!;
    for (const e of merged.values()) {
      if (e.to_id !== current || reached.has(e.from_id)) continue;
      reached.add(e.from_id);
      pending.push(e.from_id);
    }
  }

  const edges = [...merged.values()].filter(
    (e) => reached.has(e.from_id) && reached.has(e.to_id)
  );
  const level = new Map([...reached].map((id) => [id, 0]));
  for (let pass = 0; pass < reached.size; pass++)
    for (const e of edges)
      level.set(
        e.to_id,
        Math.max(level.get(e.to_id)!, level.get(e.from_id)! + 1)
      );

  return {
    nodes: graph.nodes
      .filter((n) => reached.has(n.id))
      .map((n) => {
        const fetched = fetchedById.get(n.id);
        if (fetched)
          return { ...fetched, id: n.id, slug: n.id, level: level.get(n.id)! };
        return {
          id: n.id,
          slug: n.id,
          title: n.title,
          summary: n.type === "guide_request" ? n.summary : null,
          level: level.get(n.id)!,
          duration_minutes: 0,
          tags: [],
        };
      }),
    edges,
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

// source is the prerequisite. A drawn edge cuts any path that contradicts it,
// guide edges included.
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

// The server may answer with its own id for a guide it already holds;
// adoptSavedSnapshot maps it back.
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
