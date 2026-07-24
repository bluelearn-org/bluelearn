import { client } from "@/lib/api/apiClient";

export type GraphNode = {
  id: string;
  slug: string;
  title: string;
  summary: string | null;
  level: number;
  word_count: number;
  tags: Array<{ slug: string; name: string }>;
  is_target: boolean;
  curated_position?: number;
};

export type GraphEdge = {
  from_id: string;
  to_id: string;
};

export type GraphData = {
  nodes: Array<GraphNode>;
  edges: Array<GraphEdge>;
};

export const fetchWalkthrough = async (
  targetSlug: string
): Promise<GraphData> => {
  const res = await client.guides[":slug"].walkthrough.$get({
    param: { slug: targetSlug },
  });

  if (!res.ok) {
    throw new Error("Failed to fetch walkthrough");
  }

  const data = await res.json();
  return {
    ...data,
    nodes: data.nodes.map((node) => ({
      ...node,
      is_target: node.slug === targetSlug,
    })),
  };
};

export const fetchObjectiveGraph = async (slug: string): Promise<GraphData> => {
  const objectivesData = (await import("@/data/objectives.json")).default;
  const guides = (await import("@/data/guides.json")).default;

  const objective = objectivesData.find((o: any) => o.slug === slug);
  if (!objective) {
    return Promise.reject(new Error(`Objective not found: ${slug}`));
  }

  const targetSlugs = objective.targets.map((t: any) => t.guide);

  const nodesMap = new Map<string, GraphNode>();
  const edgesSet = new Set<string>();
  const edges: Array<GraphEdge> = [];

  // 1. Gather all nodes by traversing prerequisites from targets
  const queue = [...targetSlugs];
  const targetsSet = new Set(targetSlugs);

  while (queue.length > 0) {
    const currentSlug = queue.shift()!;
    if (nodesMap.has(currentSlug)) continue;

    const guide = guides.find((g) => g.slug === currentSlug);
    if (!guide) continue;

    nodesMap.set(currentSlug, {
      id: guide.slug,
      slug: guide.slug,
      title: guide.title,
      summary: guide.summary,
      level: 0,
      word_count: 500, // mock
      tags: guide.tags.map((t) => ({ slug: t, name: t })),
      is_target: targetsSet.has(guide.slug),
    });

    for (const prereq of guide.prerequisites) {
      const edgeKey = `${prereq}->${guide.slug}`;
      if (!edgesSet.has(edgeKey)) {
        edgesSet.add(edgeKey);
        edges.push({ from_id: prereq, to_id: guide.slug });
      }
      queue.push(prereq);
    }
  }

  // 2. Calculate levels using Kahn's topological sort (matching the backend)
  const adj = new Map<string, Array<string>>(); // from -> to[]
  const inDegree = new Map<string, number>();
  const outDegree = new Map<string, number>();

  const baseIds = Array.from(nodesMap.keys());
  for (const id of baseIds) {
    adj.set(id, []);
    inDegree.set(id, 0);
    outDegree.set(id, 0);
  }

  for (const edge of edges) {
    if (adj.has(edge.from_id) && adj.has(edge.to_id)) {
      adj.get(edge.from_id)!.push(edge.to_id);
      inDegree.set(edge.to_id, inDegree.get(edge.to_id)! + 1);
      outDegree.set(edge.from_id, outDegree.get(edge.from_id)! + 1);
    }
  }

  const levels = new Map<string, number>();
  const queueWalk: Array<string> = [];

  for (const id of baseIds) {
    if (inDegree.get(id) === 0) {
      levels.set(id, 1);
      queueWalk.push(id);
    }
  }

  let maxLevel = 1;
  while (queueWalk.length > 0) {
    const u = queueWalk.shift()!;
    const uLevel = levels.get(u)!;
    for (const v of adj.get(u)!) {
      const vLevel = levels.get(v) || 1;
      if (uLevel + 1 > vLevel) {
        levels.set(v, uLevel + 1);
        if (uLevel + 1 > maxLevel) maxLevel = uLevel + 1;
      }
      const deg = inDegree.get(v)! - 1;
      inDegree.set(v, deg);
      if (deg === 0) {
        queueWalk.push(v);
      }
    }
  }

  const nodes = Array.from(nodesMap.values()).map((node) => {
    return {
      ...node,
      level: levels.get(node.slug) || 1,
    };
  });

  return { nodes, edges };
};
