import { useEffect } from "react";
import { MarkerType, useEdgesState, useNodesState } from "@xyflow/react";
import type { Edge, Node } from "@xyflow/react";
import type { Walkthrough } from "@bluelearn/schemas";

type WalkthroughNode = Walkthrough["nodes"][number];

// What the hook writes into every xyflow node's data. id and slug are dropped
// because xyflow keys by slug already.
export type GraphNodeData = Omit<WalkthroughNode, "id" | "slug"> & {
  isTarget: boolean;
  isHovered: boolean;
  isDimmed: boolean;
  centerX: number;
};

// Per-node state that changes without moving anything, merged into node data on
// its own pass so a change never triggers a relayout.
type NodeState = Record<string, unknown>;

const NO_NODE_STATE = (): NodeState => ({});

const LEVEL_SPACING = 350;

type UseGraphLayoutProps = {
  walkthroughData: Walkthrough;
  targetSlug: string;
  hoveredGuide: string | null;
  nodeType: string;
  nodeWidth: number;
  nodeSpacing: number;
  targetAtBottom?: boolean;
  getNodeState?: (slug: string) => NodeState;
};

// Maps prerequisite -> dependent edges onto slugs, which is what xyflow keys
// nodes by. Returns both directions since hovering walks the DAG each way.
function buildAdjacency(walkthroughData: Walkthrough) {
  const idToSlug = new Map(walkthroughData.nodes.map((n) => [n.id, n.slug]));

  const prereqs = new Map<string, Array<string>>();
  const dependents = new Map<string, Array<string>>();
  walkthroughData.nodes.forEach((n) => {
    prereqs.set(n.slug, []);
    dependents.set(n.slug, []);
  });

  walkthroughData.edges.forEach((edge) => {
    const from = idToSlug.get(edge.from_id);
    const to = idToSlug.get(edge.to_id);
    if (from && to) {
      prereqs.get(to)!.push(from);
      dependents.get(from)!.push(to);
    }
  });

  return { prereqs, dependents };
}

export function useGraphLayout({
  walkthroughData,
  targetSlug,
  hoveredGuide,
  nodeType,
  nodeWidth,
  nodeSpacing,
  targetAtBottom = false,
  getNodeState = NO_NODE_STATE,
}: UseGraphLayoutProps) {
  const [nodes, setNodes, onNodesChange] = useNodesState<Node>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([]);

  // 1. Layout: positions and static node data. Deliberately independent of
  // hover and selection so those never move a node.
  useEffect(() => {
    const grouped = walkthroughData.nodes.reduce(
      (acc, node) => {
        const list = acc[node.level] ?? [];
        list.push(node);
        acc[node.level] = list;
        return acc;
      },
      {} as Record<number, Array<WalkthroughNode>>
    );

    const levels = Object.keys(grouped)
      .map(Number)
      .sort((a, b) => a - b);
    const maxLevelIdx = levels.length - 1;

    const newNodes: Array<Node> = [];
    levels.forEach((level, levelIdx) => {
      const nodesInLevel = grouped[level];
      const levelY = targetAtBottom
        ? levelIdx * LEVEL_SPACING
        : (maxLevelIdx - levelIdx) * LEVEL_SPACING;

      const totalWidth = nodesInLevel.length * nodeSpacing;
      const startX = -totalWidth / 2;

      nodesInLevel.forEach((node, nodeIdx) => {
        const cellCenterX = startX + nodeIdx * nodeSpacing + nodeSpacing / 2;

        newNodes.push({
          id: node.slug,
          type: nodeType,
          position: { x: cellCenterX - nodeWidth / 2, y: levelY },
          data: {
            title: node.title,
            summary: node.summary,
            level: node.level,
            duration_minutes: node.duration_minutes,
            tags: node.tags,
            isTarget: node.slug === targetSlug,
            isHovered: false,
            isDimmed: false,
            centerX: cellCenterX,
          } satisfies GraphNodeData,
        });
      });
    });

    const { prereqs } = buildAdjacency(walkthroughData);

    // Is `ancestor` reachable from `node`, meaning `node` transitively depends
    // on `ancestor`?
    const isAncestor = (ancestor: string, node: string): boolean => {
      const queue = [...(prereqs.get(node) ?? [])];
      const visited = new Set<string>(queue);

      while (queue.length > 0) {
        const curr = queue.shift()!;
        if (curr === ancestor) return true;

        for (const p of prereqs.get(curr) ?? []) {
          if (!visited.has(p)) {
            visited.add(p);
            queue.push(p);
          }
        }
      }
      return false;
    };

    // Transitive reduction: drop an edge when the same prerequisite is already
    // reachable through another prerequisite of this node, so the graph shows
    // only the closest dependency.
    const newEdges: Array<Edge> = [];
    walkthroughData.nodes.forEach((node) => {
      const nodePrereqs = prereqs.get(node.slug) ?? [];

      nodePrereqs.forEach((prereqSlug) => {
        const isTransient = nodePrereqs.some(
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
  }, [
    walkthroughData,
    targetSlug,
    nodeType,
    nodeWidth,
    nodeSpacing,
    targetAtBottom,
    setNodes,
    setEdges,
  ]);

  useEffect(() => {
    setNodes((nds) => {
      const next = nds.map((n) => {
        const width = n.measured?.width;
        const { centerX } = n.data as GraphNodeData;
        if (!width || typeof centerX !== "number") return n;

        const x = centerX - width / 2;
        if (Math.abs(n.position.x - x) < 0.5) return n;

        return { ...n, position: { ...n.position, x } };
      });

      return next.some((n, i) => n !== nds[i]) ? next : nds;
    });
  }, [nodes, setNodes]);
  const isLayoutSettled =
    nodes.length > 0 &&
    nodes.every((n) => {
      const width = n.measured?.width;
      const { centerX } = n.data as GraphNodeData;
      if (!width) return false;

      return Math.abs(n.position.x - (centerX - width / 2)) < 0.5;
    });

  // State: hover highlighting plus whatever getNodeState reports, applied
  // without re-running layout.
  useEffect(() => {
    const { prereqs, dependents } = buildAdjacency(walkthroughData);

    // Everything upstream and downstream of the hovered node stays lit; the
    // rest dims.
    const highlighted = new Set<string>();
    if (hoveredGuide) {
      const walk = (adjacency: Map<string, Array<string>>) => {
        const queue = [hoveredGuide];
        const visited = new Set<string>();
        while (queue.length > 0) {
          const cur = queue.shift()!;
          if (visited.has(cur)) continue;
          visited.add(cur);
          highlighted.add(cur);
          queue.push(...(adjacency.get(cur) ?? []));
        }
      };
      walk(prereqs);
      walk(dependents);
    }

    setNodes((nds) =>
      nds.map((n) => {
        const next = {
          ...getNodeState(n.id),
          isDimmed: hoveredGuide !== null && !highlighted.has(n.id),
          isHovered: n.id === hoveredGuide,
        };

        const unchanged = Object.entries(next).every(
          ([key, value]) => n.data[key] === value
        );
        return unchanged ? n : { ...n, data: { ...n.data, ...next } };
      })
    );

    setEdges((eds) =>
      eds.map((e) => {
        const isDimmed =
          hoveredGuide !== null &&
          !(highlighted.has(e.source) && highlighted.has(e.target));
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
  }, [hoveredGuide, getNodeState, walkthroughData, setNodes, setEdges]);

  return {
    nodes,
    edges,
    onNodesChange,
    onEdgesChange,
    setNodes,
    isLayoutSettled,
  };
}
