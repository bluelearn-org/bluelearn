import { useEffect } from "react";
import { MarkerType, useEdgesState, useNodesState } from "@xyflow/react";
import type { Edge, Node } from "@xyflow/react";
import type { GraphData, GraphNode } from "@/lib/graphUtils";

type UseGraphLayoutProps = {
  walkthroughData: GraphData;
  targetSlug?: string;
  hoveredGuide: string | null;
  nodeType: string;
  getNodeData: (node: GraphNode, isTarget: boolean) => any;
};

export function useGraphLayout({
  walkthroughData,
  targetSlug,
  hoveredGuide,
  nodeType,
  getNodeData,
}: UseGraphLayoutProps) {
  const [nodes, setNodes, onNodesChange] = useNodesState<Node>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([]);

  // 1. Initial / Dependency Update: calculate base nodes and edges
  useEffect(() => {
    const { nodes: walkthroughNodes, edges: backendEdges } = walkthroughData;

    // Map id to slug for easy edge conversion
    const idToSlug = new Map<string, string>();
    walkthroughNodes.forEach((n) => idToSlug.set(n.id, n.slug));

    const visualDistances = new Map<string, number>();
    const targetSlugs = walkthroughNodes
      .filter(
        (n) =>
          n.is_target || (targetSlug !== undefined && n.slug === targetSlug)
      )
      .map((n) => n.slug);

    targetSlugs.forEach((t) => visualDistances.set(t, 0));

    let changed = true;
    while (changed) {
      changed = false;
      backendEdges.forEach((edge) => {
        const from = idToSlug.get(edge.from_id);
        const to = idToSlug.get(edge.to_id);
        if (from && to && visualDistances.has(to)) {
          const currentDist = visualDistances.get(from) ?? -1;
          const newDist = visualDistances.get(to)! + 1;
          if (newDist > currentDist) {
            visualDistances.set(from, newDist);
            changed = true;
          }
        }
      });
    }

    let maxDist = 0;
    visualDistances.forEach((dist) => {
      if (dist > maxDist) maxDist = dist;
    });

    const grouped = walkthroughNodes.reduce(
      (acc, node) => {
        const dist = visualDistances.get(node.slug) || 0;
        const vLevel = maxDist - dist;
        const list = acc[vLevel] ?? [];
        list.push(node);
        acc[vLevel] = list;
        return acc;
      },
      {} as Record<number, Array<GraphNode>>
    );

    const levels = Object.keys(grouped)
      .map(Number)
      .sort((a, b) => a - b);

    const maxLevelIdx = levels.length - 1;

    const newNodes: Array<Node> = [];
    levels.forEach((level, levelIdx) => {
      const nodesInLevel = grouped[level]!;

      const isWalkthrough =
        nodeType === "walkthroughNode" || nodeType === "objectiveNode";
      const nodeWidth = isWalkthrough ? 420 : 350;
      const nodeSpacing = isWalkthrough ? 480 : 380;

      // Target at top (y=0), primitives at bottom (y > 0)
      const levelY = (maxLevelIdx - levelIdx) * 350;

      const totalWidth = nodesInLevel.length * nodeSpacing;
      const startX = -totalWidth / 2;

      nodesInLevel.forEach((node, nodeIdx) => {
        const isTarget =
          node.is_target ||
          (targetSlug !== undefined && node.slug === targetSlug);

        const cellCenterX = startX + nodeIdx * nodeSpacing + nodeSpacing / 2;
        const nodeX = cellCenterX - nodeWidth / 2;

        newNodes.push({
          id: node.slug,
          type: nodeType,
          position: { x: nodeX, y: levelY },
          data: {
            ...getNodeData(node, isTarget),
            title: node.title,
            isTarget,
            isHovered: false,
            isDimmed: false,
          },
        });
      });
    });

    // Build adjacency list for edges (using slugs)
    const prereqMap = new Map<string, Array<string>>();
    walkthroughNodes.forEach((n) => prereqMap.set(n.slug, []));

    backendEdges.forEach((edge) => {
      const fromSlug = idToSlug.get(edge.from_id);
      const toSlug = idToSlug.get(edge.to_id);
      if (fromSlug && toSlug) {
        // fromSlug is the prerequisite of toSlug
        const list = prereqMap.get(toSlug) || [];
        list.push(fromSlug);
        prereqMap.set(toSlug, list);
      }
    });

    // Helper to check if `ancestor` is reachable from `node` (meaning `node` transitively depends on `ancestor`)
    const isAncestor = (ancestor: string, node: string): boolean => {
      const queue = prereqMap.get(node) ? [...prereqMap.get(node)!] : [];
      const visited = new Set<string>(queue);

      while (queue.length > 0) {
        const curr = queue.shift()!;
        if (curr === ancestor) return true;

        const currPrereqs = prereqMap.get(curr) || [];
        for (const p of currPrereqs) {
          if (!visited.has(p)) {
            visited.add(p);
            queue.push(p);
          }
        }
      }
      return false;
    };

    const newEdges: Array<Edge> = [];
    walkthroughNodes.forEach((node) => {
      const prereqs = prereqMap.get(node.slug) || [];

      prereqs.forEach((prereqSlug) => {
        // Check if this dependency is transient (redundant).
        const isTransient = prereqs.some(
          (otherPrereq) =>
            otherPrereq !== prereqSlug && isAncestor(prereqSlug, otherPrereq)
        );

        if (!isTransient) {
          newEdges.push({
            id: `e-${prereqSlug}-${node.slug}`,
            source: prereqSlug,
            target: node.slug,
            type: "default",
            style: { stroke: "#94a3b8", strokeWidth: 2 },
            animated: false,
            zIndex: 0,
            markerEnd: {
              type: MarkerType.ArrowClosed,
              color: "#94a3b8",
            },
          });
        }
      });
    });

    setNodes(newNodes);
    setEdges(newEdges);
  }, [walkthroughData, targetSlug, setNodes, setEdges, nodeType, getNodeData]);

  // 2. Hover Update: update isDimmed and isHovered without re-layout
  useEffect(() => {
    const { nodes: walkthroughNodes, edges: backendEdges } = walkthroughData;
    const idToSlug = new Map<string, string>();
    walkthroughNodes.forEach((n) => idToSlug.set(n.id, n.slug));

    const prereqMap = new Map<string, Array<string>>();
    const descMap = new Map<string, Array<string>>();
    walkthroughNodes.forEach((n) => {
      prereqMap.set(n.slug, []);
      descMap.set(n.slug, []);
    });

    backendEdges.forEach((edge) => {
      const fromSlug = idToSlug.get(edge.from_id);
      const toSlug = idToSlug.get(edge.to_id);
      if (fromSlug && toSlug) {
        prereqMap.get(toSlug)!.push(fromSlug);
        descMap.get(fromSlug)!.push(toSlug);
      }
    });

    const highlightedNodes = new Set<string>();
    if (hoveredGuide) {
      const ancQueue = [hoveredGuide];
      while (ancQueue.length > 0) {
        const cur = ancQueue.shift()!;
        if (!highlightedNodes.has(cur)) {
          highlightedNodes.add(cur);
          const prereqs = prereqMap.get(cur) || [];
          prereqs.forEach((p) => ancQueue.push(p));
        }
      }
      const descQueue = [hoveredGuide];
      const visitedDesc = new Set<string>();
      while (descQueue.length > 0) {
        const cur = descQueue.shift()!;
        if (!visitedDesc.has(cur)) {
          visitedDesc.add(cur);
          highlightedNodes.add(cur);
          const descs = descMap.get(cur) || [];
          descs.forEach((d) => descQueue.push(d));
        }
      }
    }

    setNodes((nds) =>
      nds.map((n) => {
        const isDimmed = hoveredGuide !== null && !highlightedNodes.has(n.id);
        const isHovered = n.id === hoveredGuide;

        if (n.data.isDimmed !== isDimmed || n.data.isHovered !== isHovered) {
          return {
            ...n,
            data: { ...n.data, isDimmed, isHovered },
          };
        }
        return n;
      })
    );

    setEdges((eds) =>
      eds.map((e) => {
        const isDimmed =
          hoveredGuide !== null &&
          !(highlightedNodes.has(e.source) && highlightedNodes.has(e.target));
        const strokeColor = isDimmed
          ? "#94a3b833"
          : hoveredGuide
            ? "#3b82f6"
            : "#94a3b8";
        const strokeWidth = hoveredGuide && !isDimmed ? 3 : 2;
        const zIndex = hoveredGuide && !isDimmed ? 10 : 0;
        const animated = hoveredGuide !== null && !isDimmed;

        if (
          !e.style ||
          e.style.stroke !== strokeColor ||
          e.style.strokeWidth !== strokeWidth ||
          e.animated !== animated
        ) {
          return {
            ...e,
            style: { ...e.style, stroke: strokeColor, strokeWidth },
            animated,
            zIndex,
            markerEnd: { type: MarkerType.ArrowClosed, color: strokeColor },
          };
        }
        return e;
      })
    );
  }, [hoveredGuide, setNodes, setEdges, walkthroughData]);

  return { nodes, edges, onNodesChange, onEdgesChange, setNodes };
}
